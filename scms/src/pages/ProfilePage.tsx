import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { PageHeading } from '../ui'
const blank = { headline: '', bio: '', phone: '', location: '', skills: '', name: '', website: '', industry: '', address: '', college: '', course: '' }
export default function ProfilePage() {
  const { user, reload } = useAuth(); const [f, setF] = useState(blank); const [status, setStatus] = useState(''); const [msg, setMsg] = useState(''), [err, setErr] = useState('')
  const org = user!.role === 'organization', stu = user!.role === 'student'
  useEffect(() => { Promise.all([api('/profile'), org || stu ? api('/details') : Promise.resolve({})]).then(([p, d]) => { setF({ ...blank, ...p, ...d, skills: (p.skills || []).join(', ') }); setStatus(d.status || '') }).catch(e => setErr(e.message)) }, [])
  const s = (k: string) => (x: any) => setF({ ...f, [k]: x.target.value })
  const submit = async (e: FormEvent) => { e.preventDefault(); setMsg(''); setErr('')
    if (f.website && !/^https?:\/\/\S+\.\S+/.test(f.website)) return setErr('Website must start with http:// or https://')
    try {
      await api('/profile', 'PUT', { headline: f.headline, bio: f.bio, phone: f.phone, location: f.location, skills: f.skills.split(',').map(x => x.trim()).filter(Boolean) })
      if (org) await api('/details', 'PUT', { name: f.name, website: f.website, industry: f.industry, address: f.address }); if (stu) await api('/details', 'PUT', { college: f.college, course: f.course })
      await reload(); setMsg('Profile saved.')
    } catch (x) { setErr((x as Error).message) } }
  return <div className="max-w-3xl"><PageHeading title={org ? 'Organization profile' : 'My profile'} subtitle={org ? 'Keep your organization details current and ready to share.' : 'Build a complete profile that supports your career documents.'} /><form onSubmit={submit} className="card max-w-2xl space-y-3">
    {org && <><p className="text-sm">Approval status: <b className="capitalize">{status}</b></p><input className="inp" placeholder="Organization name" value={f.name} onChange={s('name')} required /><input className="inp" placeholder="Industry" value={f.industry} onChange={s('industry')} /><input className="inp" placeholder="Website (https://…)" value={f.website} onChange={s('website')} /><input className="inp" placeholder="Address" value={f.address} onChange={s('address')} /></>}
    {stu && <div className="grid gap-3 sm:grid-cols-2"><input className="inp" placeholder="College" value={f.college} onChange={s('college')} /><input className="inp" placeholder="Course" value={f.course} onChange={s('course')} /></div>}
    <input className="inp" placeholder="Headline" value={f.headline} onChange={s('headline')} />
    <textarea className="inp" rows={4} placeholder="Bio" value={f.bio} onChange={s('bio')} />
    <div className="grid gap-3 sm:grid-cols-2"><input className="inp" placeholder="Phone (e.g. +91 98765 43210)" value={f.phone} onChange={s('phone')} /><input className="inp" placeholder="Location" value={f.location} onChange={s('location')} /></div>
    <input className="inp" placeholder="Skills (comma separated)" value={f.skills} onChange={s('skills')} />
    {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}{msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}
    <button className="btn-p">Save</button></form></div>
}
