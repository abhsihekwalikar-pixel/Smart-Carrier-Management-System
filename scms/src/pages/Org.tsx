import { useState } from 'react'
import { Ban, Copy, Download, Pencil, Trash2 } from 'lucide-react'
import { api, download, useApi } from '../api'
import { Empty, Err, Ok, PageHeading, fdate } from '../ui'
type Tpl = { id: string; name: string; body: string; signature: string | null }
type Kind = 'certificate' | 'offer_letter'
const BUILTIN = ['student_name', 'course', 'college', 'organization', 'date']
const SAMPLE: Record<Kind, string> = {
  certificate: 'This is to certify that {{student_name}} of {{college}} has successfully completed {{program}} at {{organization}} on {{date}}.',
  offer_letter: 'Dear {{student_name}},\n\nWe are pleased to offer you the position of {{role}} at {{organization}}, starting {{start_date}}.\n\nWe look forward to welcoming you.\n\nDate: {{date}}'
}
const LABEL: Record<Kind, string> = { certificate: 'Certificate', offer_letter: 'Offer letter' }
const holders = (b: string) => [...new Set([...b.matchAll(/{{\s*(\w+)\s*}}/g)].map(m => m[1]))].filter(x => !BUILTIN.includes(x))
export function Templates({ kind }: { kind: Kind }) {
  const { data, error, reload } = useApi<Tpl[]>(`/org/templates/${kind}`)
  const [ed, setEd] = useState<Tpl | 'new' | null>(null); const [f, setF] = useState({ name: '', body: '', signature: '' as string | null }); const [err, setErr] = useState(''), [ok, setOk] = useState('')
  const open = (t: Tpl | 'new') => { setEd(t); setErr(''); setOk(''); setF(t === 'new' ? { name: '', body: SAMPLE[kind], signature: null } : { name: t.name, body: t.body, signature: t.signature }) }
  const pick = (file?: File) => { if (!file) return; if (!file.type.startsWith('image/')) return setErr('Signature must be an image file.'); if (file.size > 400_000) return setErr('Signature image must be under 400 KB.'); const r = new FileReader(); r.onload = () => { setErr(''); setF(x => ({ ...x, signature: r.result as string })) }; r.readAsDataURL(file) }
  const save = async () => { try { setErr(''); if (ed === 'new') await api(`/org/templates/${kind}`, 'POST', f); else await api(`/org/templates/${kind}/${(ed as Tpl).id}`, 'PUT', f); setEd(null); setOk('Template saved.'); reload() } catch (e) { setErr((e as Error).message) } }
  const del = async (t: Tpl) => { if (!confirm(`Delete "${t.name}"?`)) return; try { await api(`/org/templates/${kind}/${t.id}`, 'DELETE'); setOk('Template deleted.'); reload() } catch (e) { setErr((e as Error).message) } }
  return <div className="max-w-4xl"><PageHeading title={`${LABEL[kind]} templates`} subtitle="Create reusable, polished documents for your students." action={!ed && <button className="btn-p" onClick={() => open('new')}>New template</button>} /><Err m={error || err} /><Ok m={ok} />
    {ed ? <div className="card space-y-3"><input className="inp" placeholder="Template name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <textarea className="inp font-mono" rows={9} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
      <p className="text-xs text-slate-500">Built-in placeholders: {BUILTIN.map(b => `{{${b}}}`).join(' ')}. Any other {'{{name}}'} becomes a field you fill in when generating.</p>
      <div><label className="text-sm font-medium">Digital signature (image)</label><input type="file" accept="image/*" className="mt-1 block text-sm" onChange={e => pick(e.target.files?.[0])} />{f.signature && <div className="mt-2 flex items-center gap-3"><img src={f.signature} className="h-12 rounded border bg-white p-1" /><button className="btn-o py-1" onClick={() => setF({ ...f, signature: null })}>Remove</button></div>}</div>
      <div className="flex gap-2"><button className="btn-p" onClick={save}>Save</button><button className="btn-o" onClick={() => setEd(null)}>Cancel</button></div></div>
    : data && (data.length === 0 ? <Empty t="No templates yet. Create your first one." /> : <div className="space-y-2">{data.map(t => <div key={t.id} className="card flex items-start justify-between gap-3"><div><div className="font-medium">{t.name}</div><div className="mt-1 line-clamp-2 text-sm text-slate-500">{t.body}</div></div><div className="flex gap-2"><button className="btn-o py-1" onClick={() => open(t)}><Pencil size={14} />Edit</button><button className="btn-o py-1 text-red-600" onClick={() => del(t)}><Trash2 size={14} /></button></div></div>)}</div>)}</div>
}
function parseCSV(t: string) {
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false
  for (let i = 0; i < t.length; i++) { const ch = t[i]
    if (q) { if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = [] } else cur += ch }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row); return rows
}
export function Generate() {
  const [kind, setKind] = useState<Kind>('certificate'); const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const tpls = useApi<Tpl[]>(`/org/templates/${kind}`); const [tid, setTid] = useState(''); const [q, setQ] = useState(''); const students = useApi<{ id: string; name: string; email: string; course: string }[]>('/org/students?q=' + encodeURIComponent(q))
  const [sid, setSid] = useState(''); const [extra, setExtra] = useState<Record<string, string>>({}); const [csv, setCsv] = useState(''); const [err, setErr] = useState(''); const [res, setRes] = useState<any[]>([]); const [busy, setBusy] = useState(false)
  const tpl = tpls.data?.find(t => t.id === tid); const fields = tpl ? holders(tpl.body) : []
  const reset = (k: Kind) => { setKind(k); setTid(''); setRes([]); setErr(''); setExtra({}) }
  const run = async () => { setErr(''); setRes([]); if (!tid) return setErr('Choose a template first.'); setBusy(true)
    try {
      if (mode === 'single') { if (!sid) throw new Error('Choose a student.'); const r = await api('/org/generate', 'POST', { kind, template_id: tid, student_id: sid, extra }); setRes([{ ...r, ok: true }]) }
      else { const rows = parseCSV(csv); if (rows.length < 2) throw new Error('CSV needs a header row and at least one data row.'); const h = rows[0].map(x => x.trim()); if (!h.includes('email')) throw new Error('CSV header must include an "email" column.')
        setRes(await api('/org/bulk', 'POST', { kind, template_id: tid, rows: rows.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, (r[i] || '').trim()]))) })) }
    } catch (e) { setErr((e as Error).message) } setBusy(false) }
  return <div className="max-w-4xl space-y-4"><PageHeading title="Generate documents" subtitle="Issue certificates and offer letters individually or in bulk." />
    <div className="card space-y-3"><div className="grid grid-cols-2 gap-2">{(['certificate', 'offer_letter'] as Kind[]).map(k => <button key={k} className={kind === k ? 'btn-p' : 'btn-o'} onClick={() => reset(k)}>{LABEL[k]}</button>)}</div>
      <select className="inp" value={tid} onChange={e => { setTid(e.target.value); setExtra({}) }}><option value="">Select template…</option>{tpls.data?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      {tpls.data?.length === 0 && <p className="text-sm text-amber-700">Create a {LABEL[kind].toLowerCase()} template first.</p>}
      <div className="grid grid-cols-2 gap-2">{(['single', 'bulk'] as const).map(m => <button key={m} className={mode === m ? 'btn-p' : 'btn-o'} onClick={() => { setMode(m); setRes([]) }}>{m === 'single' ? 'Single student' : 'Bulk (CSV)'}</button>)}</div>
      {mode === 'single' ? <><input className="inp" placeholder="Search students by name, email, college…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="inp" size={5} value={sid} onChange={e => setSid(e.target.value)}>{students.data?.map(s => <option key={s.id} value={s.id}>{s.name} — {s.email}{s.course ? ` (${s.course})` : ''}</option>)}</select>
        {fields.map(k => <input key={k} className="inp" placeholder={k} value={extra[k] || ''} onChange={e => setExtra({ ...extra, [k]: e.target.value })} />)}</>
      : <><p className="text-xs text-slate-500">Header row must contain <b>email</b>{fields.length > 0 && <> plus: <b>{fields.join(', ')}</b></>}. Only registered students are matched.</p>
        <textarea className="inp font-mono" rows={6} placeholder={'email,' + (fields.join(',') || 'program') + '\nstudent@example.com,Python'} value={csv} onChange={e => setCsv(e.target.value)} />
        <input type="file" accept=".csv,text/csv" className="text-sm" onChange={async e => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()) }} /></>}
      <Err m={err} /><button className="btn-p" disabled={busy} onClick={run}>{busy ? 'Generating…' : 'Generate'}</button></div>
    {res.length > 0 && <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Student</th><th>Result</th><th /></tr></thead><tbody>{res.map((r, i) => <tr key={i} className="border-t"><td className="p-3">{r.student || r.email}</td><td className={r.ok ? 'text-green-700' : 'text-red-700'}>{r.ok ? `Issued · ID ${r.verification_id}` : r.error}</td><td className="pr-3 text-right">{r.ok && <button className="btn-o py-1" onClick={() => download(`/documents/${r.verification_id}/pdf?base=${encodeURIComponent(location.origin)}`, `${kind}-${r.verification_id}.pdf`).catch(e => setErr(e.message))}><Download size={14} />PDF</button>}</td></tr>)}</tbody></table></div>}</div>
}
export function Documents() {
  const { data, error, reload } = useApi<{ verification_id: string; kind: Kind; student: string; issued: string; revoked: boolean }[]>('/org/documents'); const [err, setErr] = useState(''); const [ok, setOk] = useState('')
  const revoke = async (id: string) => { if (!confirm('Revoke this document? Verification will show it as revoked.')) return; try { await api(`/org/documents/${id}/revoke`, 'POST'); reload() } catch (e) { setErr((e as Error).message) } }
  const copy = (id: string) => navigator.clipboard.writeText(`${location.origin}/verify/${id}`).then(() => setOk('Verification link copied.'))
  return <div><PageHeading title="Issued documents" subtitle="Track issued records, download PDFs, and manage verification." /><Err m={error || err} /><Ok m={ok} />
    {data && (data.length === 0 ? <Empty t="No documents issued yet." /> : <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">ID</th><th>Type</th><th>Student</th><th>Issued</th><th>Status</th><th /></tr></thead><tbody>
      {data.map(d => <tr key={d.verification_id} className="border-t"><td className="p-3 font-mono text-xs">{d.verification_id}</td><td>{LABEL[d.kind]}</td><td>{d.student}</td><td>{fdate(d.issued)}</td><td>{d.revoked ? <span className="text-red-600">Revoked</span> : 'Valid'}</td>
        <td className="space-x-1 pr-3 text-right"><button className="btn-o py-1" title="Copy verification link" onClick={() => copy(d.verification_id)}><Copy size={14} /></button>{!d.revoked && <><button className="btn-o py-1" onClick={() => download(`/documents/${d.verification_id}/pdf?base=${encodeURIComponent(location.origin)}`, `${d.kind}-${d.verification_id}.pdf`).catch(e => setErr(e.message))}><Download size={14} /></button><button className="btn-o py-1 text-red-600" onClick={() => revoke(d.verification_id)}><Ban size={14} /></button></>}</td></tr>)}</tbody></table></div>)}</div>
}
export function OrgStudents() {
  const [q, setQ] = useState(''); const { data, error } = useApi<{ id: string; name: string; email: string; college: string; course: string }[]>('/org/students?q=' + encodeURIComponent(q))
  return <div><PageHeading title="Student records" subtitle="Find students connected to your organization." /><input className="inp mb-3 max-w-sm" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} /><Err m={error} />
    {data && (data.length === 0 ? <Empty t="No students found." /> : <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Name</th><th>Email</th><th>College</th><th>Course</th></tr></thead><tbody>{data.map(s => <tr key={s.id} className="border-t"><td className="p-3">{s.name}</td><td>{s.email}</td><td>{s.college}</td><td>{s.course}</td></tr>)}</tbody></table></div>)}</div>
}
