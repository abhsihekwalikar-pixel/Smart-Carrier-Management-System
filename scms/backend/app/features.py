import base64, io, json, re, secrets, zipfile
from datetime import datetime
from typing import Literal
from xml.sax.saxutils import escape
import qrcode
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pypdf import PdfReader
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from .core import *
r = APIRouter()
Kind = Literal['certificate', 'offer_letter']
TPL = {'certificate': CertificateTemplate, 'offer_letter': OfferLetterTemplate}; DOC = {'certificate': Certificate, 'offer_letter': OfferLetter}
TITLE = {'certificate': 'Certificate', 'offer_letter': 'Offer Letter'}
# ================= helpers =================
def org_of(u: User, db: Session) -> Organization:
    o = db.scalar(select(Organization).where(Organization.user_id == u.id))
    if not o: raise HTTPException(403, 'Organization account required.')
    if o.status != 'approved': raise HTTPException(403, 'Your organization is not approved yet.')
    return o
def student_of(u: User, db: Session) -> Student:
    s = db.scalar(select(Student).where(Student.user_id == u.id))
    if not s: raise HTTPException(403, 'Student account required.')
    return s
def render(body: str, data: dict) -> str:
    missing = sorted(set(re.findall(r'{{\s*(\w+)\s*}}', body)) - set(data))
    if missing: raise HTTPException(422, 'Missing values for placeholders: ' + ', '.join(missing))
    return re.sub(r'{{\s*(\w+)\s*}}', lambda m: str(data[m.group(1)]), body)
def check_sig(sig: str | None):
    if sig and (not sig.startswith('data:image/') or len(sig) > 600_000): raise HTTPException(422, 'Signature must be an image under ~400 KB.')
def png(url: str) -> io.BytesIO:
    b = io.BytesIO(); qrcode.make(url).save(b, format='PNG'); b.seek(0); return b
def sig_img(sig: str | None):
    try: return Image(io.BytesIO(base64.b64decode(sig.split(',', 1)[1])), width=45 * mm, height=18 * mm, kind='proportional') if sig else None
    except Exception: return None
def pdf_doc(title: str, text: str, org: str, vid: str, sig: str | None, base: str) -> bytes:
    buf = io.BytesIO(); d = SimpleDocTemplate(buf, pagesize=A4, leftMargin=25 * mm, rightMargin=25 * mm, topMargin=25 * mm, bottomMargin=20 * mm); st = getSampleStyleSheet()
    T = ParagraphStyle('t', parent=st['Title'], fontSize=26, spaceAfter=20); B = ParagraphStyle('b', parent=st['BodyText'], fontSize=12, leading=19, spaceAfter=8)
    el = [Paragraph(escape(org), st['Heading2']), Paragraph(escape(title), T)] + [Paragraph(escape(p) or '&nbsp;', B) for p in text.split('\n')] + [Spacer(1, 18)]
    if (s := sig_img(sig)): el += [s, Paragraph('Authorised signatory', st['Italic'])]
    url = f'{base.rstrip("/")}/verify/{vid}'
    el += [Spacer(1, 24), Table([[Paragraph(f'<b>Verification ID:</b> {vid}<br/>Verify at: {escape(url)}', st['BodyText']), Image(png(url), width=30 * mm, height=30 * mm)]], colWidths=[120 * mm, 35 * mm])]
    d.build(el); return buf.getvalue()
def pdf_resume(c: dict) -> bytes:
    buf = io.BytesIO(); d = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm); st = getSampleStyleSheet()
    H = ParagraphStyle('h', parent=st['Heading3'], textColor='#1F3A8A', spaceBefore=10, spaceAfter=4)
    el = [Paragraph(escape(c.get('name') or 'Resume'), st['Title']), Paragraph(escape(' | '.join(x for x in [c.get('email'), c.get('phone'), c.get('location')] if x)), st['BodyText'])]
    if c.get('summary'): el += [Paragraph('Summary', H), Paragraph(escape(c['summary']), st['BodyText'])]
    if c.get('skills'): el += [Paragraph('Skills', H), Paragraph(escape(', '.join(c['skills'])), st['BodyText'])]
    for key, label in [('experience', 'Experience'), ('projects', 'Projects'), ('education', 'Education')]:
        if c.get(key):
            el.append(Paragraph(label, H))
            for it in c[key]:
                el.append(Paragraph(f"<b>{escape(it.get('title', ''))}</b>", st['BodyText']))
                for ln in (it.get('detail') or '').split('\n'):
                    if ln.strip(): el.append(Paragraph('• ' + escape(ln.strip()), st['BodyText']))
    d.build(el); return buf.getvalue()
def pdf_response(data: bytes, name: str): return Response(data, media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename="{name}.pdf"'})
# ================= Organization: templates =================
class TplIn(BaseModel): name: str = Field(min_length=1, max_length=160); body: str = Field(min_length=10); signature: str | None = None
def tpl_dict(t): return {'id': t.id, 'name': t.name, 'body': t.body, 'signature': t.signature_path}
@r.get('/org/templates/{kind}')
def tpl_list(kind: Kind, u: User = Depends(require('templates.own')), db: Session = Depends(get_db)):
    o = org_of(u, db); M = TPL[kind]; return [tpl_dict(t) for t in db.scalars(select(M).where(M.org_id == o.id).order_by(M.created_at.desc()))]
@r.post('/org/templates/{kind}', status_code=201)
def tpl_create(kind: Kind, b: TplIn, u: User = Depends(require('templates.own')), db: Session = Depends(get_db)):
    o = org_of(u, db); check_sig(b.signature); t = TPL[kind](org_id=o.id, name=b.name.strip(), body=b.body, signature_path=b.signature); db.add(t)
    log(db, u.name, 'TEMPLATE_CREATE', f'{kind}: {b.name}', u.id); db.commit(); return tpl_dict(t)
def own_tpl(db, o, kind, tid):
    t = db.get(TPL[kind], tid)
    if not t or t.org_id != o.id: raise HTTPException(404, 'Template not found')
    return t
@r.put('/org/templates/{kind}/{tid}')
def tpl_update(kind: Kind, tid: str, b: TplIn, u: User = Depends(require('templates.own')), db: Session = Depends(get_db)):
    o = org_of(u, db); t = own_tpl(db, o, kind, tid); check_sig(b.signature); t.name, t.body, t.signature_path = b.name.strip(), b.body, b.signature
    log(db, u.name, 'TEMPLATE_UPDATE', t.name, u.id); db.commit(); return tpl_dict(t)
def in_use(db, kind, tid): return db.scalar(select(func.count()).select_from(DOC[kind]).where(DOC[kind].template_id == tid)) > 0
@r.delete('/org/templates/{kind}/{tid}')
def tpl_delete(kind: Kind, tid: str, u: User = Depends(require('templates.own')), db: Session = Depends(get_db)):
    o = org_of(u, db); t = own_tpl(db, o, kind, tid)
    if in_use(db, kind, tid): raise HTTPException(409, 'This template has issued documents and cannot be deleted.')
    db.delete(t); log(db, u.name, 'TEMPLATE_DELETE', t.name, u.id); db.commit(); return {'ok': True}
# ================= Organization: students, generation, documents =================
@r.get('/org/students')
def org_students(q: str = '', u: User = Depends(require('students.view')), db: Session = Depends(get_db)):
    org_of(u, db); st = select(Student, User).join(User, User.id == Student.user_id).where(User.active == True).order_by(User.name).limit(200)  # noqa: E712
    if q: st = st.where(User.name.contains(q) | User.email.contains(q) | Student.college.contains(q) | Student.course.contains(q))
    return [{'id': s.id, 'name': x.name, 'email': x.email, 'college': s.college, 'course': s.course} for s, x in db.execute(st)]
def issue(db: Session, o: Organization, kind: str, tpl, st: Student, extra: dict) -> dict:
    su = db.get(User, st.user_id)
    data = {'student_name': su.name, 'course': st.course, 'college': st.college, 'organization': o.name, 'date': datetime.utcnow().strftime('%d %B %Y'), **{k: v for k, v in extra.items() if v != ''}}
    text = render(tpl.body, data); vid = secrets.token_hex(6).upper()
    d = DOC[kind](org_id=o.id, template_id=tpl.id, student_id=st.id, verification_id=vid, data={**data, 'text': text}); db.add(d); db.flush()
    db.add(DocumentVerification(verification_id=vid, doc_type=kind, doc_id=d.id, issued_to=su.name, issued_by=o.name))
    notify(db, su.id, f'{o.name} issued you a {TITLE[kind].lower()} (ID {vid}).'); return {'verification_id': vid, 'student': su.name}
class GenIn(BaseModel): kind: Kind; template_id: str; student_id: str; extra: dict[str, str] = {}
@r.post('/org/generate', status_code=201)
def generate(b: GenIn, u: User = Depends(require('documents.generate')), db: Session = Depends(get_db)):
    o = org_of(u, db); t = own_tpl(db, o, b.kind, b.template_id); st = db.get(Student, b.student_id)
    if not st: raise HTTPException(404, 'Student not found')
    res = issue(db, o, b.kind, t, st, b.extra); log(db, u.name, 'DOC_ISSUE', f'{b.kind} {res["verification_id"]} to {res["student"]}', u.id); db.commit(); return res
class BulkIn(BaseModel): kind: Kind; template_id: str; rows: list[dict[str, str]] = Field(min_length=1, max_length=500)
@r.post('/org/bulk')
def bulk(b: BulkIn, u: User = Depends(require('documents.generate')), db: Session = Depends(get_db)):
    o = org_of(u, db); t = own_tpl(db, o, b.kind, b.template_id); out = []
    for row in b.rows:
        email = (row.get('email') or '').strip().lower()
        st = db.scalar(select(Student).join(User, User.id == Student.user_id).where(User.email == email)) if email else None
        if not st: out.append({'email': email, 'ok': False, 'error': 'No student registered with this email'}); continue
        try: out.append({'email': email, 'ok': True, **issue(db, o, b.kind, t, st, {k: v for k, v in row.items() if k != 'email'})})
        except HTTPException as e: out.append({'email': email, 'ok': False, 'error': e.detail})
    log(db, u.name, 'DOC_BULK', f'{sum(x["ok"] for x in out)}/{len(out)} issued', u.id); db.commit(); return out
@r.get('/org/documents')
def org_docs(u: User = Depends(require('documents.verify')), db: Session = Depends(get_db)):
    o = org_of(u, db); rows = []
    for kind, M in DOC.items():
        for d, v, su in db.execute(select(M, DocumentVerification, User).join(DocumentVerification, DocumentVerification.verification_id == M.verification_id).join(Student, Student.id == M.student_id).join(User, User.id == Student.user_id).where(M.org_id == o.id)):
            rows.append({'verification_id': d.verification_id, 'kind': kind, 'student': su.name, 'issued': d.created_at, 'revoked': v.revoked})
    return sorted(rows, key=lambda x: x['issued'], reverse=True)
@r.post('/org/documents/{vid}/revoke')
def revoke(vid: str, u: User = Depends(require('documents.verify')), db: Session = Depends(get_db)):
    o = org_of(u, db); v = db.scalar(select(DocumentVerification).where(DocumentVerification.verification_id == vid.upper()))
    if not v or not db.scalar(select(DOC[v.doc_type]).where(DOC[v.doc_type].verification_id == v.verification_id, DOC[v.doc_type].org_id == o.id)): raise HTTPException(404, 'Document not found')
    v.revoked = True; log(db, u.name, 'DOC_REVOKE', vid, u.id); db.commit(); return {'ok': True}
@r.get('/documents/{vid}/pdf')
def doc_pdf(vid: str, base: str = 'http://localhost:5173', u: User = Depends(current_user), db: Session = Depends(get_db)):
    v = db.scalar(select(DocumentVerification).where(DocumentVerification.verification_id == vid.upper()))
    if not v: raise HTTPException(404, 'Document not found')
    d = db.scalar(select(DOC[v.doc_type]).where(DOC[v.doc_type].verification_id == v.verification_id)); role = role_name(db, u)
    mine_org = (o := db.scalar(select(Organization).where(Organization.user_id == u.id))) and o.id == d.org_id
    mine_stu = (s := db.scalar(select(Student).where(Student.user_id == u.id))) and s.id == d.student_id
    if not (role == 'super_admin' or mine_org or mine_stu): raise HTTPException(403, 'You do not have access to this document.')
    if v.revoked and role != 'super_admin': raise HTTPException(410, 'This document has been revoked.')
    sig = db.get(TPL[v.doc_type], d.template_id).signature_path
    return pdf_response(pdf_doc(TITLE[v.doc_type], d.data.get('text', ''), v.issued_by, vid.upper(), sig, base), f'{v.doc_type}-{vid.upper()}')
@r.get('/student/documents')
def stu_docs(u: User = Depends(require('documents.download')), db: Session = Depends(get_db)):
    s = student_of(u, db); rows = []
    for kind, M in DOC.items():
        for d, v in db.execute(select(M, DocumentVerification).join(DocumentVerification, DocumentVerification.verification_id == M.verification_id).where(M.student_id == s.id)):
            rows.append({'verification_id': d.verification_id, 'kind': kind, 'issued_by': v.issued_by, 'issued': d.created_at, 'revoked': v.revoked})
    return sorted(rows, key=lambda x: x['issued'], reverse=True)
# ================= Super Admin: templates + AI config =================
@r.get('/admin/templates')
def admin_tpls(_: User = Depends(require('templates.manage')), db: Session = Depends(get_db)):
    return [{'id': t.id, 'kind': k, 'name': t.name, 'organization': o.name, 'in_use': in_use(db, k, t.id)} for k, M in TPL.items() for t, o in db.execute(select(M, Organization).join(Organization, Organization.id == M.org_id))]
@r.delete('/admin/templates/{kind}/{tid}')
def admin_tpl_del(kind: Kind, tid: str, a: User = Depends(require('templates.manage')), db: Session = Depends(get_db)):
    t = db.get(TPL[kind], tid)
    if not t: raise HTTPException(404, 'Template not found')
    if in_use(db, kind, tid): raise HTTPException(409, 'Template has issued documents and cannot be deleted.')
    db.delete(t); log(db, a.name, 'ADMIN_TEMPLATE_DELETE', t.name, a.id); db.commit(); return {'ok': True}
def ai_cfg(db) -> dict:
    row = db.scalar(select(AiPrompt).where(AiPrompt.kind == 'config')); return json.loads(row.output) if row else {'enabled': True, 'tone': 'professional'}
class AiCfg(BaseModel): enabled: bool; tone: Literal['professional', 'friendly', 'concise']
@r.get('/admin/ai-config')
def get_ai_cfg(_: User = Depends(require('ai.configure')), db: Session = Depends(get_db)): return ai_cfg(db)
@r.put('/admin/ai-config')
def put_ai_cfg(b: AiCfg, a: User = Depends(require('ai.configure')), db: Session = Depends(get_db)):
    row = db.scalar(select(AiPrompt).where(AiPrompt.kind == 'config'))
    if not row: row = AiPrompt(user_id=a.id, kind='config', prompt='config'); db.add(row)
    row.output = json.dumps(b.model_dump()); log(db, a.name, 'AI_CONFIG', row.output, a.id); db.commit(); return b
def need_ai(db):
    c = ai_cfg(db)
    if not c['enabled']: raise HTTPException(503, 'AI features are disabled by the administrator.')
    return c
# ================= Student: resumes =================
class ResumeIn(BaseModel): title: str = Field(min_length=1, max_length=160); content: dict
def clean(c: dict) -> dict:
    s = lambda k: str(c.get(k) or '')[:2000]; items = lambda k: [{'title': str(i.get('title', ''))[:200], 'detail': str(i.get('detail', ''))[:3000]} for i in (c.get(k) or []) if isinstance(i, dict) and (i.get('title') or i.get('detail'))]
    return {'name': s('name'), 'email': s('email'), 'phone': s('phone'), 'location': s('location'), 'summary': s('summary'), 'skills': [str(x).strip() for x in (c.get('skills') or []) if str(x).strip()][:60], 'education': items('education'), 'experience': items('experience'), 'projects': items('projects')}
def own_resume(db, u, rid):
    x = db.get(Resume, rid)
    if not x or x.user_id != u.id: raise HTTPException(404, 'Resume not found')
    return x
def add_version(db, x, content):
    n = (db.scalar(select(func.max(ResumeVersion.version)).where(ResumeVersion.resume_id == x.id)) or 0) + 1; db.add(ResumeVersion(resume_id=x.id, version=n, content=content)); x.content = content; return n
@r.get('/resumes')
def resumes(u: User = Depends(require('resume.manage')), db: Session = Depends(get_db)):
    return [{'id': x.id, 'title': x.title, 'source': x.source, 'created': x.created_at, 'versions': db.scalar(select(func.count()).select_from(ResumeVersion).where(ResumeVersion.resume_id == x.id))} for x in db.scalars(select(Resume).where(Resume.user_id == u.id).order_by(Resume.created_at.desc()))]
@r.post('/resumes', status_code=201)
def resume_create(b: ResumeIn, u: User = Depends(require('resume.manage')), db: Session = Depends(get_db)):
    x = Resume(user_id=u.id, title=b.title.strip(), source='builder', content={}); db.add(x); db.flush(); add_version(db, x, clean(b.content)); log(db, u.name, 'RESUME_CREATE', b.title, u.id); db.commit(); return {'id': x.id}
@r.get('/resumes/{rid}')
def resume_get(rid: str, u: User = Depends(require('resume.manage')), db: Session = Depends(get_db)): x = own_resume(db, u, rid); return {'id': x.id, 'title': x.title, 'source': x.source, 'content': x.content}
@r.put('/resumes/{rid}')
def resume_put(rid: str, b: ResumeIn, u: User = Depends(require('resume.manage')), db: Session = Depends(get_db)):
    x = own_resume(db, u, rid); x.title = b.title.strip(); n = add_version(db, x, clean(b.content)); log(db, u.name, 'RESUME_UPDATE', f'{x.title} v{n}', u.id); db.commit(); return {'version': n}
@r.delete('/resumes/{rid}')
def resume_del(rid: str, u: User = Depends(require('resume.manage')), db: Session = Depends(get_db)):
    x = own_resume(db, u, rid)
    for v in db.scalars(select(ResumeVersion).where(ResumeVersion.resume_id == rid)): db.delete(v)
    db.delete(x); log(db, u.name, 'RESUME_DELETE', x.title, u.id); db.commit(); return {'ok': True}
@r.get('/resumes/{rid}/versions')
def versions(rid: str, u: User = Depends(require('resume.manage')), db: Session = Depends(get_db)):
    own_resume(db, u, rid); return [{'version': v.version, 'created': v.created_at} for v in db.scalars(select(ResumeVersion).where(ResumeVersion.resume_id == rid).order_by(ResumeVersion.version.desc()))]
@r.post('/resumes/{rid}/restore/{ver}')
def restore(rid: str, ver: int, u: User = Depends(require('resume.manage')), db: Session = Depends(get_db)):
    x = own_resume(db, u, rid); v = db.scalar(select(ResumeVersion).where(ResumeVersion.resume_id == rid, ResumeVersion.version == ver))
    if not v: raise HTTPException(404, 'Version not found')
    n = add_version(db, x, v.content); db.commit(); return {'version': n}
@r.get('/resumes/{rid}/pdf')
def resume_pdf(rid: str, u: User = Depends(require('resume.manage')), db: Session = Depends(get_db)): x = own_resume(db, u, rid); return pdf_response(pdf_resume(x.content), 'resume')
def extract_text(name: str, raw: bytes) -> str:
    n = name.lower()
    if n.endswith('.pdf'): return '\n'.join((p.extract_text() or '') for p in PdfReader(io.BytesIO(raw)).pages)
    if n.endswith('.docx'):
        with zipfile.ZipFile(io.BytesIO(raw)) as z: xml = z.read('word/document.xml').decode('utf8', 'ignore')
        return re.sub(r'<[^>]+>', '', xml.replace('</w:p>', '\n'))
    if n.endswith('.txt'): return raw.decode('utf8', 'ignore')
    raise HTTPException(422, 'Upload a .pdf, .docx or .txt file.')
def parse_resume(text: str) -> dict:
    lines = [l.strip(' \t•-*') for l in text.splitlines() if l.strip()]
    heads = {'skills': 'skills', 'technical skills': 'skills', 'education': 'education', 'experience': 'experience', 'work experience': 'experience', 'projects': 'projects', 'summary': 'summary', 'objective': 'summary', 'profile': 'summary'}
    buf: dict[str, list[str]] = {k: [] for k in [*set(heads.values()), 'header']}; sec = 'header'
    for l in lines:
        if l.lower().rstrip(':') in heads: sec = heads[l.lower().rstrip(':')]; continue
        buf[sec].append(l)
    em = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', text); ph = re.search(r'\+?\d[\d\s-]{8,14}\d', text)
    ent = lambda k: [{'title': l, 'detail': ''} for l in buf[k]]
    return clean({'name': buf['header'][0] if buf['header'] else '', 'email': em.group() if em else '', 'phone': ph.group() if ph else '', 'summary': ' '.join(buf['summary']), 'skills': [s.strip() for l in buf['skills'] for s in re.split(r'[,|;•]', l)], 'education': ent('education'), 'experience': ent('experience'), 'projects': ent('projects')})
class UploadIn(BaseModel): filename: str; data: str; title: str = ''
@r.post('/resumes/upload', status_code=201)
def resume_upload(b: UploadIn, u: User = Depends(require('resume.manage')), db: Session = Depends(get_db)):
    if len(b.data) > 7_000_000: raise HTTPException(413, 'File too large (max 5 MB).')
    try: raw = base64.b64decode(b.data.split(',')[-1])
    except Exception: raise HTTPException(422, 'Could not read the uploaded file.')
    try: text = extract_text(b.filename, raw)
    except HTTPException: raise
    except Exception: raise HTTPException(422, 'Could not read text from this file.')
    if len(text.strip()) < 20: raise HTTPException(422, 'No readable text found in this file.')
    x = Resume(user_id=u.id, title=b.title.strip() or b.filename, source='upload', content={}); db.add(x); db.flush(); add_version(db, x, parse_resume(text)); log(db, u.name, 'RESUME_UPLOAD', b.filename, u.id); db.commit(); return {'id': x.id}
# ================= Student: AI (rule-based generator, no external LLM) =================
WEAK = [(r'^(worked on|worked with)\b', 'Contributed to'), (r'^responsible for\b', 'Managed'), (r'^helped\b', 'Supported'), (r'^did\b', 'Completed'), (r'^made\b', 'Built')]
def enhance(c: dict, tone: str) -> tuple[dict, list[str]]:
    out = json.loads(json.dumps(c)); ch = []
    seen = []; [seen.append(s) for s in out['skills'] if s.lower() not in [x.lower() for x in seen]]
    if len(seen) != len(out['skills']): ch.append('Removed duplicate skills')
    out['skills'] = seen
    if not out['summary'] and out['skills']:
        out['summary'] = {'professional': 'Results-driven professional skilled in ', 'friendly': 'Enthusiastic learner who enjoys working with ', 'concise': 'Skilled in '}[tone] + ', '.join(out['skills'][:5]) + '.'; ch.append('Generated a summary from your skills')
    for k in ('experience', 'projects'):
        for it in out[k]:
            new = []
            for ln in it['detail'].split('\n'):
                s = ln.strip()
                if not s: continue
                for pat, rep in WEAK: s = re.sub(pat, rep, s, flags=re.I)
                s = s[0].upper() + s[1:]; s += '' if s[-1] in '.!?' else '.'; new.append(s)
            if '\n'.join(new) != it['detail']: ch.append(f'Polished bullets in "{it["title"][:40]}"')
            it['detail'] = '\n'.join(new)
    return out, ch
class EnhIn(BaseModel): resume_id: str
@r.post('/ai/enhance-resume')
def ai_enhance(b: EnhIn, u: User = Depends(require('resume.manage')), db: Session = Depends(get_db)):
    cfg = need_ai(db); x = own_resume(db, u, b.resume_id); out, ch = enhance(x.content, cfg['tone'])
    db.add(AiPrompt(user_id=u.id, kind='enhance', prompt=x.title, output=json.dumps(ch))); db.commit(); return {'content': out, 'changes': ch or ['No improvements found; your resume is already clean.']}
def slugify(s: str) -> str: return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:40] or 'portfolio'
class PortIn(BaseModel): prompt: str = Field('', max_length=1000); resume_id: str | None = None; title: str = ''
@r.post('/ai/portfolio', status_code=201)
def ai_portfolio(b: PortIn, u: User = Depends(require('portfolio.manage')), db: Session = Depends(get_db)):
    cfg = need_ai(db); pr = db.scalar(select(Profile).where(Profile.user_id == u.id)); st = db.scalar(select(Student).where(Student.user_id == u.id)); c = clean({})
    if b.resume_id: c = own_resume(db, u, b.resume_id).content
    elif not b.prompt.strip() and not pr.bio and not pr.skills: raise HTTPException(422, 'Give a prompt, pick a resume, or fill in your profile first.')
    skills = list(dict.fromkeys([*c['skills'], *pr.skills])); bio = b.prompt.strip() or c['summary'] or pr.bio
    lead = {'professional': f"{u.name} is a {pr.headline or (st.course if st else '') or 'motivated'} professional. ", 'friendly': f"Hi, I'm {u.name}! ", 'concise': ''}[cfg['tone']]
    secs = [('about', {'text': (lead + bio).strip()}), ('skills', {'items': skills}), ('experience', {'items': c['experience']}), ('projects', {'items': c['projects']}), ('education', {'items': c['education'] or ([{'title': st.college, 'detail': st.course}] if st and (st.college or st.course) else [])}),
            ('contact', {'text': ' | '.join(x for x in [u.email, pr.phone or c['phone'], pr.location] if x)})]
    p = Portfolio(user_id=u.id, slug=f'{slugify(u.name)}-{secrets.token_hex(2)}', title=b.title.strip() or f"{u.name}'s Portfolio"); db.add(p); db.flush()
    for i, (t, ct) in enumerate(secs):
        if ct.get('items') == [] : continue
        db.add(PortfolioSection(portfolio_id=p.id, type=t, content=ct, position=i))
    db.add(AiPrompt(user_id=u.id, kind='portfolio', prompt=b.prompt or '(from resume/profile)', output=p.slug)); log(db, u.name, 'PORTFOLIO_CREATE', p.slug, u.id); db.commit(); return {'id': p.id, 'slug': p.slug}
# ================= Student: portfolios =================
def own_port(db, u, pid):
    p = db.get(Portfolio, pid)
    if not p or p.user_id != u.id: raise HTTPException(404, 'Portfolio not found')
    return p
def secs_of(db, pid): return [{'type': s.type, 'content': s.content} for s in db.scalars(select(PortfolioSection).where(PortfolioSection.portfolio_id == pid).order_by(PortfolioSection.position))]
@r.get('/portfolios')
def ports(u: User = Depends(require('portfolio.manage')), db: Session = Depends(get_db)): return [{'id': p.id, 'title': p.title, 'slug': p.slug, 'published': p.published} for p in db.scalars(select(Portfolio).where(Portfolio.user_id == u.id).order_by(Portfolio.created_at.desc()))]
@r.get('/portfolios/{pid}')
def port_get(pid: str, u: User = Depends(require('portfolio.manage')), db: Session = Depends(get_db)): p = own_port(db, u, pid); return {'id': p.id, 'title': p.title, 'slug': p.slug, 'published': p.published, 'sections': secs_of(db, pid)}
class Sec(BaseModel): type: Literal['about', 'skills', 'experience', 'projects', 'education', 'contact']; content: dict
class PortPut(BaseModel): title: str = Field(min_length=1, max_length=160); published: bool; sections: list[Sec]
@r.put('/portfolios/{pid}')
def port_put(pid: str, b: PortPut, u: User = Depends(require('portfolio.manage')), db: Session = Depends(get_db)):
    p = own_port(db, u, pid); p.title, p.published = b.title.strip(), b.published
    for s in db.scalars(select(PortfolioSection).where(PortfolioSection.portfolio_id == pid)): db.delete(s)
    for i, s in enumerate(b.sections): db.add(PortfolioSection(portfolio_id=pid, type=s.type, content=s.content, position=i))
    log(db, u.name, 'PORTFOLIO_PUBLISH' if b.published else 'PORTFOLIO_UPDATE', p.slug, u.id); db.commit(); return {'ok': True}
@r.delete('/portfolios/{pid}')
def port_del(pid: str, u: User = Depends(require('portfolio.manage')), db: Session = Depends(get_db)):
    p = own_port(db, u, pid)
    for s in db.scalars(select(PortfolioSection).where(PortfolioSection.portfolio_id == pid)): db.delete(s)
    db.delete(p); log(db, u.name, 'PORTFOLIO_DELETE', p.slug, u.id); db.commit(); return {'ok': True}
@r.get('/p/{slug}')  # public
def public_port(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(Portfolio).where(Portfolio.slug == slug, Portfolio.published == True))  # noqa: E712
    if not p: raise HTTPException(404, 'This portfolio does not exist or is not published.')
    return {'title': p.title, 'owner': db.get(User, p.user_id).name, 'sections': secs_of(db, p.id)}
