import os, base64; os.environ['DATABASE_URL'] = 'sqlite:///./test2.db'
from fastapi.testclient import TestClient
from app.main import app
H = lambda t: {'Authorization': 'Bearer ' + t}
def reg(c, **k): assert c.post('/auth/register', json=k).status_code == 201
def login(c, e, p='pass1234'): return c.post('/auth/login', json={'email': e, 'password': p}).json()['access_token']
with TestClient(app) as c:
    reg(c, name='Asha', email='asha@x.com', password='pass1234', role='student', college='NIT', course='CSE')
    reg(c, name='Ravi', email='ravi@x.com', password='pass1234', role='student')
    reg(c, name='HR', email='hr@acme.com', password='pass1234', role='organization', org_name='Acme')
    A, O, S = login(c, 'admin@scms.com', 'Admin@123'), login(c, 'hr@acme.com'), login(c, 'asha@x.com')
    body = 'This certifies that {{student_name}} of {{college}} completed {{program}} at {{organization}} on {{date}}.'
    assert c.get('/org/templates/certificate', headers=H(O)).status_code == 403          # org not approved yet
    org = c.get('/admin/organizations', headers=H(A)).json()[0]; c.post(f"/admin/organizations/{org['id']}/status", json={'status': 'approved'}, headers=H(A))
    assert c.get('/org/templates/certificate', headers=H(S)).status_code == 403          # student blocked
    assert c.post('/org/templates/certificate', json={'name': 'T', 'body': 'short'}, headers=H(O)).status_code == 422
    sig = 'data:image/png;base64,' + base64.b64encode(bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201a5f645400000000049454e44ae426082')).decode()
    t = c.post('/org/templates/certificate', json={'name': 'Completion', 'body': body, 'signature': sig}, headers=H(O)); assert t.status_code == 201; tid = t.json()['id']
    stu = c.get('/org/students?q=asha', headers=H(O)).json(); assert len(stu) == 1; sid = stu[0]['id']
    r = c.post('/org/generate', json={'kind': 'certificate', 'template_id': tid, 'student_id': sid}, headers=H(O)); assert r.status_code == 422 and 'program' in r.json()['detail']  # missing placeholder
    r = c.post('/org/generate', json={'kind': 'certificate', 'template_id': tid, 'student_id': sid, 'extra': {'program': 'Python'}}, headers=H(O)); assert r.status_code == 201; vid = r.json()['verification_id']
    v = c.get('/verify/' + vid).json(); assert v['valid'] and v['issued_to'] == 'Asha' and v['issued_by'] == 'Acme'
    p = c.get(f'/documents/{vid}/pdf?base=http://localhost:5173', headers=H(S)); assert p.status_code == 200 and p.content[:4] == b'%PDF'
    assert c.get(f'/documents/{vid}/pdf', headers=H(login(c, 'ravi@x.com'))).status_code == 403   # other student cannot download
    assert len(c.get('/student/documents', headers=H(S)).json()) == 1
    b = c.post('/org/bulk', json={'kind': 'certificate', 'template_id': tid, 'rows': [{'email': 'asha@x.com', 'program': 'AI'}, {'email': 'ravi@x.com'}, {'email': 'nobody@x.com', 'program': 'X'}]}, headers=H(O)).json()
    assert [x['ok'] for x in b] == [True, False, False]
    assert c.delete(f'/org/templates/certificate/{tid}', headers=H(O)).status_code == 409        # template in use
    assert c.post(f'/org/documents/{vid}/revoke', headers=H(O)).status_code == 200
    assert c.get('/verify/' + vid).json()['revoked'] is True and c.get(f'/documents/{vid}/pdf', headers=H(S)).status_code == 410
    templates = c.get('/admin/templates', headers=H(A)).json()
    assert len(c.get('/org/documents', headers=H(O)).json()) == 2 and any(t['name'] == 'Completion' and t['organization'] == 'Acme' for t in templates)
    # ---- student: resume, versions, upload, AI, portfolio ----
    cont = {'name': 'Asha', 'email': 'asha@x.com', 'summary': '', 'skills': ['Python', 'python', 'SQL'], 'experience': [{'title': 'Intern', 'detail': 'worked on APIs\nhelped the team'}]}
    rid = c.post('/resumes', json={'title': 'Main', 'content': cont}, headers=H(S)).json()['id']
    assert c.put(f'/resumes/{rid}', json={'title': 'Main', 'content': {**cont, 'name': 'Asha K'}}, headers=H(S)).json()['version'] == 2
    assert [v['version'] for v in c.get(f'/resumes/{rid}/versions', headers=H(S)).json()] == [2, 1]
    assert c.post(f'/resumes/{rid}/restore/1', headers=H(S)).json()['version'] == 3 and c.get(f'/resumes/{rid}', headers=H(S)).json()['content']['name'] == 'Asha'
    assert c.get(f'/resumes/{rid}', headers=H(login(c, 'ravi@x.com'))).status_code == 404       # not yours
    assert c.get(f'/resumes/{rid}/pdf', headers=H(S)).content[:4] == b'%PDF'
    txt = 'Asha Kumar\nasha@x.com\n+91 98765 43210\nSkills\nPython, FastAPI, SQL\nEducation\nNIT Trichy B.Tech\nExperience\nBackend Intern\n'
    up = c.post('/resumes/upload', json={'filename': 'cv.txt', 'data': base64.b64encode(txt.encode()).decode()}, headers=H(S)); assert up.status_code == 201
    pc = c.get(f"/resumes/{up.json()['id']}", headers=H(S)).json()['content']; assert pc['name'] == 'Asha Kumar' and 'FastAPI' in pc['skills'] and pc['email'] == 'asha@x.com'
    assert c.post('/resumes/upload', json={'filename': 'cv.exe', 'data': 'AAAA'}, headers=H(S)).status_code == 422
    e = c.post('/ai/enhance-resume', json={'resume_id': rid}, headers=H(S)).json(); assert e['content']['skills'] == ['Python', 'SQL'] and e['content']['summary'] and e['content']['experience'][0]['detail'].startswith('Contributed to APIs.')
    assert c.put('/admin/ai-config', json={'enabled': False, 'tone': 'friendly'}, headers=H(A)).status_code == 200
    assert c.post('/ai/enhance-resume', json={'resume_id': rid}, headers=H(S)).status_code == 503
    c.put('/admin/ai-config', json={'enabled': True, 'tone': 'friendly'}, headers=H(A))
    pf = c.post('/ai/portfolio', json={'prompt': 'Backend developer who loves APIs', 'resume_id': rid}, headers=H(S)); assert pf.status_code == 201; pid, slug = pf.json()['id'], pf.json()['slug']
    assert c.get('/p/' + slug).status_code == 404                                                # unpublished is private
    g = c.get(f'/portfolios/{pid}', headers=H(S)).json(); assert g['sections'][0]['content']['text'].startswith("Hi, I'm Asha!")
    assert c.put(f'/portfolios/{pid}', json={'title': 'Mine', 'published': True, 'sections': g['sections']}, headers=H(S)).status_code == 200
    assert c.get('/p/' + slug).json()['title'] == 'Mine'
    assert c.post('/ai/portfolio', json={}, headers=H(login(c, 'ravi@x.com'))).status_code == 422  # nothing to generate from
    assert c.post('/resumes', json={'title': 'x', 'content': {}}, headers=H(O)).status_code == 403  # org cannot use student features
print('ALL FEATURE TESTS PASSED')
