import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowUpRight, Clock3, Download, ExternalLink, FileText, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import { api, download, useApi } from '../api'
import { Empty, Err, Ok, PageHeading, SiteFooter, fdate } from '../ui'
type Item = { title: string; detail: string }
type RC = { name: string; email: string; phone: string; location: string; summary: string; skills: string[]; education: Item[]; experience: Item[]; projects: Item[] }
const blank: RC = { name: '', email: '', phone: '', location: '', summary: '', skills: [], education: [], experience: [], projects: [] }
export function Resumes() {
  const { data, error, reload } = useApi<{ id: string; title: string; source: string; created: string; versions: number }[]>('/resumes'); const nav = useNavigate(); const [err, setErr] = useState('')
  const upload = async (f?: File) => { if (!f) return; if (f.size > 5_000_000) return setErr('File too large (max 5 MB).'); const r = new FileReader()
    r.onload = async () => { try { const d = await api('/resumes/upload', 'POST', { filename: f.name, data: (r.result as string).split(',')[1] }); nav('/app/resumes/' + d.id) } catch (e) { setErr((e as Error).message) } }; r.readAsDataURL(f) }
  const del = async (id: string) => { if (confirm('Delete this resume and all its versions?')) { await api('/resumes/' + id, 'DELETE').catch(e => setErr(e.message)); reload() } }
  const totalVersions = data?.reduce((sum, resume) => sum + resume.versions, 0) || 0
  return <div className="resume-page">
    <section className="resume-hero">
      <div className="resume-hero-decoration"><FileText size={76} strokeWidth={0.7} /></div>
      <div className="resume-hero-copy"><span className="resume-kicker"><span /> YOUR CAREER TOOLKIT</span><h1>My resumes</h1><p>Keep your experience ready for whatever comes next. Build from scratch or bring a resume you already have.</p></div>
      <div className="resume-hero-actions"><label className="resume-upload-button"><Upload size={16} />Upload resume<input type="file" hidden accept=".pdf,.docx,.txt" onChange={e => upload(e.target.files?.[0])} /></label><Link to="/app/resumes/new" className="resume-create-button"><Plus size={16} />Build a resume<ArrowUpRight size={15} /></Link></div>
      <div className="resume-hero-meta"><span><strong>{data?.length ?? '—'}</strong> {data?.length === 1 ? 'resume' : 'resumes'}</span><i /><span><strong>{data ? totalVersions : '—'}</strong> saved versions</span><span className="resume-meta-hint"><Sparkles size={13} /> A stronger profile starts here</span></div>
    </section>
    <div className="resume-list-heading"><div><h2>Your library</h2><p>{data?.length ? 'Pick up where you left off.' : 'Your career documents will live here.'}</p></div>{data?.length ? <span className="resume-count-pill">{data.length} {data.length === 1 ? 'ITEM' : 'ITEMS'}</span> : null}</div>
    <Err m={error || err} />
    {data && (data.length === 0 ? <div className="resume-empty">
      <div className="resume-empty-art"><span><FileText size={27} /></span><i /><b>✳</b></div><h3>Your next opportunity deserves a great introduction.</h3><p>Create a polished resume from scratch or upload an existing PDF, DOCX, or TXT file to get started.</p>
      <div className="flex flex-wrap justify-center gap-2"><Link to="/app/resumes/new" className="resume-create-button"><Plus size={16} />Build a resume<ArrowUpRight size={15} /></Link><label className="resume-upload-button"><Upload size={16} />Upload an existing resume<input type="file" hidden accept=".pdf,.docx,.txt" onChange={e => upload(e.target.files?.[0])} /></label></div>
    </div> : <div className="resume-list">{data.map((r, index) => <article key={r.id} className="resume-item" style={{ animationDelay: `${index * 70}ms` }}>
      <Link to={'/app/resumes/' + r.id} className="resume-item-main"><span className="resume-item-icon"><FileText size={21} /></span><span className="resume-item-copy"><strong>{r.title}</strong><span>{r.source === 'upload' ? 'Uploaded resume' : 'Created in SCMS'} <i /> {r.versions} {r.versions === 1 ? 'version' : 'versions'} <i /> <Clock3 size={12} /> {fdate(r.created)}</span></span><span className="resume-item-open">Open resume <ArrowUpRight size={15} /></span></Link>
      <button aria-label={`Delete ${r.title}`} title="Delete resume" className="resume-delete" onClick={() => del(r.id)}><Trash2 size={15} /></button>
    </article>)}</div>)}
  </div>
}
function Entries({ label, items, onChange }: { label: string; items: Item[]; onChange: (i: Item[]) => void }) {
  return <div><div className="mb-1 flex items-center justify-between"><b className="text-sm">{label}</b><button type="button" className="btn-o py-1" onClick={() => onChange([...items, { title: '', detail: '' }])}><Plus size={14} />Add</button></div>
    {items.map((it, i) => <div key={i} className="mb-2 space-y-1 rounded-lg border p-2"><div className="flex gap-2"><input className="inp" placeholder="Title" value={it.title} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /><button type="button" className="btn-o" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={14} /></button></div><textarea className="inp" rows={3} placeholder="Details (one bullet per line)" value={it.detail} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, detail: e.target.value } : x))} /></div>)}</div>
}
export function ResumeEditor() {
  const { id } = useParams(); const nav = useNavigate(); const isNew = id === 'new'; const [title, setTitle] = useState('My Resume'); const [c, setC] = useState<RC>(blank); const [skills, setSkills] = useState('')
  const [err, setErr] = useState(''), [ok, setOk] = useState(''); const [ai, setAi] = useState<{ content: RC; changes: string[] } | null>(null); const vers = useApi<{ version: number; created: string }[]>(isNew ? '/profile' : `/resumes/${id}/versions`)
  const load = () => api(`/resumes/${id}`).then(d => { setTitle(d.title); setC({ ...blank, ...d.content }); setSkills((d.content.skills || []).join(', ')) }).catch(e => setErr(e.message))
  useEffect(() => { if (isNew) { api('/profile').then(p => api('/auth/me').then(m => { setC({ ...blank, name: m.name, email: m.email, phone: p.phone, location: p.location, summary: p.bio, skills: p.skills }); setSkills(p.skills.join(', ')) })).catch(() => {}) } else load() }, [id])
  const set = (k: keyof RC) => (e: any) => setC({ ...c, [k]: e.target.value })
  const body = () => ({ title, content: { ...c, skills: skills.split(',').map(s => s.trim()).filter(Boolean) } })
  const save = async () => { setErr(''); setOk(''); if (!title.trim()) return setErr('Give the resume a title.'); if (!c.name.trim()) return setErr('Your name is required.')
    try { if (isNew) { const d = await api('/resumes', 'POST', body()); nav('/app/resumes/' + d.id, { replace: true }) } else { const d = await api('/resumes/' + id, 'PUT', body()); setOk(`Saved as version ${d.version}.`); vers.reload() } } catch (e) { setErr((e as Error).message) } }
  const enhance = async () => { setErr(''); try { setAi(await api('/ai/enhance-resume', 'POST', { resume_id: id })) } catch (e) { setErr((e as Error).message) } }
  const apply = () => { if (!ai) return; setC(ai.content); setSkills(ai.content.skills.join(', ')); setAi(null); setOk('Suggestions applied. Click Save to keep them.') }
  const restore = async (v: number) => { try { await api(`/resumes/${id}/restore/${v}`, 'POST'); await load(); vers.reload(); setOk(`Version ${v} restored as a new version.`) } catch (e) { setErr((e as Error).message) } }
  return <div className="max-w-5xl"><PageHeading title={isNew ? 'New resume' : 'Edit resume'} subtitle={isNew ? 'Shape your experience into a clear, compelling resume.' : 'Keep your details current and save each improvement as a version.'} action={!isNew && <div className="flex gap-2"><button className="btn-o" onClick={enhance}><Sparkles size={16} />AI enhance</button><button className="btn-o" onClick={() => download(`/resumes/${id}/pdf`, 'resume.pdf').catch(e => setErr(e.message))}><Download size={16} />PDF</button></div>} />
    <div className="grid gap-4 lg:grid-cols-3"><div className="card space-y-3 lg:col-span-2">
    <Err m={err} /><Ok m={ok} />
    {ai && <div className="rounded-lg border border-brand-500 bg-brand-50 p-3 text-sm"><b>AI suggestions</b><ul className="my-2 list-disc pl-5">{ai.changes.map((x, i) => <li key={i}>{x}</li>)}</ul><div className="flex gap-2"><button className="btn-p py-1" onClick={apply}>Apply</button><button className="btn-o py-1" onClick={() => setAi(null)}>Dismiss</button></div></div>}
    <input className="inp" placeholder="Resume title" value={title} onChange={e => setTitle(e.target.value)} />
    <div className="grid gap-2 sm:grid-cols-2"><input className="inp" placeholder="Full name" value={c.name} onChange={set('name')} /><input className="inp" placeholder="Email" value={c.email} onChange={set('email')} /><input className="inp" placeholder="Phone" value={c.phone} onChange={set('phone')} /><input className="inp" placeholder="Location" value={c.location} onChange={set('location')} /></div>
    <textarea className="inp" rows={3} placeholder="Professional summary" value={c.summary} onChange={set('summary')} /><input className="inp" placeholder="Skills (comma separated)" value={skills} onChange={e => setSkills(e.target.value)} />
    <Entries label="Experience" items={c.experience} onChange={x => setC({ ...c, experience: x })} /><Entries label="Projects" items={c.projects} onChange={x => setC({ ...c, projects: x })} /><Entries label="Education" items={c.education} onChange={x => setC({ ...c, education: x })} />
    <div className="flex gap-2"><button className="btn-p" onClick={save}>Save</button><Link className="btn-o" to="/app/resumes">Back</Link></div></div>
    {!isNew && <div className="card h-fit"><b>Version history</b><div className="mt-2 space-y-2 text-sm">{vers.data?.map(v => <div key={v.version} className="flex items-center justify-between"><span>v{v.version} · {fdate(v.created)}</span>{v.version !== vers.data![0].version && <button className="btn-o py-1" onClick={() => restore(v.version)}>Restore</button>}</div>)}</div></div>}</div></div>
}
export function Portfolios() {
  const { data, error, reload } = useApi<{ id: string; title: string; slug: string; published: boolean }[]>('/portfolios'); const rs = useApi<{ id: string; title: string }[]>('/resumes'); const nav = useNavigate()
  const [prompt, setPrompt] = useState(''), [rid, setRid] = useState(''), [title, setTitle] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const gen = async () => { setErr(''); setBusy(true); try { const d = await api('/ai/portfolio', 'POST', { prompt, resume_id: rid || null, title }); nav('/app/portfolios/' + d.id) } catch (e) { setErr((e as Error).message) } setBusy(false) }
  const del = async (id: string) => { if (confirm('Delete this portfolio?')) { await api('/portfolios/' + id, 'DELETE').catch(e => setErr(e.message)); reload() } }
  return <div className="max-w-4xl space-y-4"><PageHeading title="My portfolios" subtitle="Turn your experience into a shareable story of your work." />
    <div className="card space-y-3"><b className="flex items-center gap-2"><Sparkles size={16} />Generate a portfolio</b><p className="text-xs text-slate-500">Describe yourself and/or pick a resume. Content is assembled from your prompt, resume and profile using the tone set by the admin.</p>
      <input className="inp" placeholder="Portfolio title (optional)" value={title} onChange={e => setTitle(e.target.value)} /><textarea className="inp" rows={3} placeholder="e.g. Backend developer who loves building secure APIs" value={prompt} onChange={e => setPrompt(e.target.value)} />
      <select className="inp" value={rid} onChange={e => setRid(e.target.value)}><option value="">No resume (use prompt + profile)</option>{rs.data?.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select><Err m={err || error} /><button className="btn-p" disabled={busy} onClick={gen}>{busy ? 'Generating…' : 'Generate portfolio'}</button></div>
    {data && (data.length === 0 ? <Empty t="No portfolios yet." /> : <div className="space-y-2">{data.map(p => <div key={p.id} className="card flex items-center justify-between"><Link to={'/app/portfolios/' + p.id}><div className="font-medium">{p.title}</div><div className="text-xs text-slate-500">{p.published ? 'Published' : 'Draft'} · /p/{p.slug}</div></Link><div className="flex gap-2">{p.published && <a className="btn-o py-1" href={'/p/' + p.slug} target="_blank"><ExternalLink size={14} /></a>}<button className="btn-o py-1 text-red-600" onClick={() => del(p.id)}><Trash2 size={14} /></button></div></div>)}</div>)}</div>
}
type Sec = { type: string; content: any }
const toText = (s: Sec) => s.type === 'skills' ? (s.content.items || []).join(', ') : s.type === 'about' || s.type === 'contact' ? s.content.text || '' : (s.content.items || []).map((i: Item) => `${i.title} | ${(i.detail || '').replace(/\n/g, ' / ')}`).join('\n')
const fromText = (type: string, t: string) => type === 'skills' ? { items: t.split(',').map(x => x.trim()).filter(Boolean) } : type === 'about' || type === 'contact' ? { text: t } : { items: t.split('\n').filter(l => l.trim()).map(l => { const [a, ...b] = l.split('|'); return { title: a.trim(), detail: b.join('|').trim().replace(/ \/ /g, '\n') } }) }
export function PortfolioEditor() {
  const { id } = useParams(); const [title, setTitle] = useState(''); const [pub, setPub] = useState(false); const [slug, setSlug] = useState(''); const [texts, setTexts] = useState<{ type: string; text: string }[]>([]); const [err, setErr] = useState(''), [ok, setOk] = useState('')
  useEffect(() => { api(`/portfolios/${id}`).then(d => { setTitle(d.title); setPub(d.published); setSlug(d.slug); setTexts(d.sections.map((s: Sec) => ({ type: s.type, text: toText(s) }))) }).catch(e => setErr(e.message)) }, [id])
  const save = async () => { setErr(''); setOk(''); if (!title.trim()) return setErr('Title is required.'); try { await api(`/portfolios/${id}`, 'PUT', { title, published: pub, sections: texts.map(t => ({ type: t.type, content: fromText(t.type, t.text) })) }); setOk(pub ? 'Saved and published.' : 'Saved as draft.') } catch (e) { setErr((e as Error).message) } }
  const link = `${location.origin}/p/${slug}`
  return <div className="max-w-4xl"><PageHeading title="Edit portfolio" subtitle="Refine your story and choose whether it is ready to share." /><div className="card max-w-3xl space-y-3"><Err m={err} /><Ok m={ok} /><input className="inp" value={title} onChange={e => setTitle(e.target.value)} />
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pub} onChange={e => setPub(e.target.checked)} />Published (anyone with the link can view)</label>
    {pub && <div className="flex gap-2 text-sm"><input className="inp" readOnly value={link} /><button className="btn-o" onClick={() => navigator.clipboard.writeText(link).then(() => setOk('Link copied.'))}>Copy</button></div>}
    {texts.map((t, i) => <div key={i}><label className="text-sm font-medium capitalize">{t.type}</label>{['experience', 'projects', 'education'].includes(t.type) && <span className="ml-2 text-xs text-slate-400">one per line: Title | details</span>}<textarea className="inp mt-1" rows={t.type === 'skills' || t.type === 'contact' ? 2 : 4} value={t.text} onChange={e => setTexts(texts.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} /></div>)}
    <div className="flex gap-2"><button className="btn-p" onClick={save}>Save</button><Link to="/app/portfolios" className="btn-o">Back</Link></div></div></div>
}
export function MyDocuments() {
  const { data, error } = useApi<{ verification_id: string; kind: string; issued_by: string; issued: string; revoked: boolean }[]>('/student/documents'); const [err, setErr] = useState('')
  return <div className="max-w-4xl"><PageHeading title="My documents" subtitle="Keep your certificates and offer letters together in one place." /><Err m={error || err} />
    {data && (data.length === 0 ? <Empty t="Certificates and offer letters issued to you will appear here." /> : <div className="space-y-2">{data.map(d => <div key={d.verification_id} className="card flex items-center justify-between"><div><div className="font-medium capitalize">{d.kind.replace('_', ' ')} · {d.issued_by}</div><div className="text-xs text-slate-500">{fdate(d.issued)} · ID {d.verification_id}{d.revoked && <span className="ml-2 text-red-600">Revoked</span>}</div></div>
      {!d.revoked && <button className="btn-p py-1" onClick={() => download(`/documents/${d.verification_id}/pdf?base=${encodeURIComponent(location.origin)}`, `${d.kind}-${d.verification_id}.pdf`).catch(e => setErr(e.message))}><Download size={14} />Download PDF</button>}</div>)}</div>)}</div>
}
export function PublicPortfolio() {
  const { slug } = useParams(); const [d, setD] = useState<any>(null); const [err, setErr] = useState('')
  useEffect(() => { api('/p/' + slug, 'GET', undefined, false).then(setD).catch(e => setErr(e.message)) }, [slug])
  const H = ({ t }: { t: string }) => <h2 className="mb-2 mt-8 border-b pb-1 text-sm font-semibold uppercase tracking-wide text-brand-700">{t}</h2>
  return <div className="public-portfolio-page flex min-h-screen flex-col">
    <main className="flex-1">
      {err ? <div className="mx-auto max-w-lg p-10 text-center"><p className="card">{err}</p></div> : !d ? <div className="p-10 text-slate-500">Loading…</div> :
        <div className="mx-auto max-w-3xl p-6 md:p-10"><h1 className="text-4xl font-bold">{d.title}</h1><p className="text-slate-500">{d.owner}</p>
          {d.sections.map((s: Sec, i: number) => <div key={i}><H t={s.type} />{s.type === 'skills' ? <div className="flex flex-wrap gap-2">{s.content.items.map((x: string) => <span key={x} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">{x}</span>)}</div> : s.content.text !== undefined ? <p className="whitespace-pre-line">{s.content.text}</p> : s.content.items.map((it: Item, j: number) => <div key={j} className="mb-3"><div className="font-medium">{it.title}</div><div className="whitespace-pre-line text-sm text-slate-600">{it.detail}</div></div>)}</div>)}</div>}
    </main>
    <SiteFooter />
  </div>
}
