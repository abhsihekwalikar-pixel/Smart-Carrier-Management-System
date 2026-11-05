import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Award, Building2, Globe2, MapPin, Phone, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../auth'
import { BrandLogo, SiteFooter } from '../ui'
const Wrap = ({ title, children }: { title: string; children: any }) => {
  const { user } = useAuth()
  const homeTo = user ? '/app' : '/'
  return <div className="auth-screen relative flex min-h-screen flex-col justify-between overflow-hidden px-4 py-6 sm:px-6">
    <div className="auth-glow auth-glow-left" />
    <div className="auth-glow auth-glow-right" />
    <div className="auth-orbit auth-orbit-left" />
    <div className="auth-orbit auth-orbit-right" />
    <div className="auth-card relative mx-auto my-auto grid w-full max-w-5xl overflow-hidden lg:grid-cols-[.9fr_1.1fr]">
      <aside className="auth-panel relative hidden flex-col justify-between overflow-hidden p-9 text-white lg:flex">
        <div className="auth-panel-glow" />
        <div className="relative">
          <Link to={homeTo} className="inline-flex items-center gap-3 text-lg font-bold tracking-tight" aria-label={user ? 'Go to dashboard home' : 'SCMS home'}><span className="auth-brand-mark flex h-10 w-10 items-center justify-center rounded-xl"><BrandLogo /></span>SCMS<span className="auth-brand-dot">.</span></Link>
          <p className="auth-kicker mt-16 text-xs font-semibold uppercase tracking-[0.18em]">Your next chapter starts here</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight">Make your work visible. Make your achievements count.</h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">A professional space to build your career profile, manage credentials and share verified accomplishments.</p>
        </div>
        <div className="relative space-y-3 text-sm text-slate-300">
          <div className="auth-benefit flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg"><Sparkles size={17} /></span>Career-ready profiles</div>
          <div className="auth-benefit flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg"><Award size={17} /></span>Professional credentials</div>
          <div className="auth-benefit flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg"><ShieldCheck size={17} /></span>Trusted verification</div>
        </div>
      </aside>
      <div className="auth-form-panel p-6 sm:p-9">
        <Link to={homeTo} className="auth-back mb-8 inline-flex items-center gap-2 text-sm font-medium transition"><ArrowLeft size={16} />{user ? 'Back to dashboard' : 'Back to home'}</Link>
        <div className="mb-6 lg:mb-8"><h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1><p className="mt-2 text-sm text-slate-500">Continue to your SCMS career workspace.</p></div>
        {children}
      </div>
    </div>
    <SiteFooter homeTo={homeTo} />
  </div>
}
export function Login() {
  const { login, user, logout } = useAuth(); const nav = useNavigate()
  const [e, setE] = useState(''), [p, setP] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [switchingAccount, setSwitchingAccount] = useState(false)
  if (user && !switchingAccount) return <Wrap title="You’re already signed in">
    <p className="text-sm leading-6 text-slate-600">You’re signed in as <strong>{user.name}</strong> ({user.email}). Choose whether to continue to your workspace or switch accounts.</p>
    <Link to="/app" className="btn-p mt-5 w-full">Continue to dashboard <ArrowRight size={16} /></Link>
    <button type="button" className="btn-o mt-3 w-full" onClick={() => { logout(); setSwitchingAccount(true) }}>Sign in with another account</button>
  </Wrap>
  const submit = async (ev: FormEvent) => { ev.preventDefault(); setErr(''); setBusy(true); try { await login(e, p); nav('/app') } catch (x) { setErr((x as Error).message) } setBusy(false) }
  return <Wrap title="Welcome back"><form onSubmit={submit} className="space-y-4">
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">Email address<input className="inp" type="email" placeholder="you@example.com" value={e} onChange={x => setE(x.target.value)} required /></label>
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">Password<input className="inp" type="password" placeholder="Enter your password" value={p} onChange={x => setP(x.target.value)} required /></label>
    {err && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
    <button className="btn-p w-full" disabled={busy}>{busy ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}</button></form>
    <p className="auth-form-footer mt-6 border-t pt-5 text-sm text-slate-500">New to SCMS? <Link className="font-semibold" to="/register">Create an account</Link></p></Wrap>
}
export function Register() {
  const { register } = useAuth()
  const [f, setF] = useState({ role: 'student' as 'student' | 'organization', name: '', email: '', password: '', orgName: '', orgWebsite: '', orgIndustry: '', orgAddress: '', contactPhone: '', college: '', course: '' })
  const [err, setErr] = useState(''), [ok, setOk] = useState('')
  const s = (k: string) => (x: any) => setF({ ...f, [k]: x.target.value })
  const submit = async (ev: FormEvent) => { ev.preventDefault(); setErr(''); try { setOk(await register(f)) } catch (x) { setErr((x as Error).message) } }
  if (ok) return <Wrap title="Registration complete"><p className="text-sm">{ok}</p><Link to="/login" className="btn-p mt-4 w-full">Go to sign in</Link></Wrap>
  return <Wrap title="Create your account"><form onSubmit={submit} className="space-y-3.5">
    <div><p className="mb-2 text-sm font-medium text-slate-700">I’m joining as a</p><div className="grid grid-cols-2 gap-2">{(['student', 'organization'] as const).map(r => <button type="button" key={r} onClick={() => setF({ ...f, role: r })} className={`auth-role-option ${f.role === r ? 'auth-role-option-active' : ''}`}>{r === 'student' ? 'Student' : 'Organization'}</button>)}</div></div>
    {f.role === 'organization' && <>
      <div className="auth-section-heading border-t pt-4"><p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Building2 size={16} />Organization details</p><p className="mt-1 text-xs leading-5 text-slate-500">Share a few details so our team can review your organization.</p></div>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700">Registered organization name<input className="inp" placeholder="e.g. Northstar Technologies" autoComplete="organization" maxLength={160} value={f.orgName} onChange={s('orgName')} required /></label>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700">Industry<select className="inp" value={f.orgIndustry} onChange={s('orgIndustry')} required><option value="">Select an industry</option>{['Technology & software', 'Education', 'Healthcare & life sciences', 'Finance & banking', 'Manufacturing & engineering', 'Consulting & professional services', 'Retail & consumer goods', 'Media & communications', 'Nonprofit & government', 'Other'].map(i => <option key={i} value={i}>{i}</option>)}</select></label>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700"><span className="flex items-center gap-1.5"><Globe2 size={14} className="text-slate-400" />Company website <span className="font-normal text-slate-400">(optional)</span></span><input className="inp" type="url" placeholder="https://company.com" autoComplete="url" maxLength={255} value={f.orgWebsite} onChange={s('orgWebsite')} /></label>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700"><span className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" />Office address <span className="font-normal text-slate-400">(optional)</span></span><input className="inp" placeholder="City, state / region, country" autoComplete="street-address" maxLength={255} value={f.orgAddress} onChange={s('orgAddress')} /></label>
      <p className="auth-review-note border-l-2 pl-3 text-xs leading-5 text-slate-500">Organizations are reviewed by an administrator before issuing credentials.</p>
      <div className="auth-section-heading border-t pt-4"><p className="text-sm font-semibold text-slate-800">Primary contact</p></div>
    </>}
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">{f.role === 'organization' ? 'Contact person name' : 'Full name'}<input className="inp" placeholder="Your name" autoComplete="name" maxLength={120} value={f.name} onChange={s('name')} required /></label>
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">{f.role === 'organization' ? 'Work email' : 'Email address'}<input className="inp" type="email" placeholder="you@example.com" autoComplete="email" value={f.email} onChange={s('email')} required />{f.role === 'organization' && <span className="block text-xs font-normal text-slate-500">Used to sign in and manage your organization.</span>}</label>
    {f.role === 'organization' && <label className="block space-y-1.5 text-sm font-medium text-slate-700"><span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" />Contact phone <span className="font-normal text-slate-400">(optional)</span></span><input className="inp" type="tel" placeholder="+1 555 123 4567" autoComplete="tel" maxLength={16} value={f.contactPhone} onChange={s('contactPhone')} /></label>}
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">Password<input className="inp" type="password" placeholder="8+ characters, letters and numbers" autoComplete="new-password" value={f.password} onChange={s('password')} required /></label>
    {f.role === 'student' && <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1.5 text-sm font-medium text-slate-700">College<input className="inp" placeholder="College or university" value={f.college} onChange={s('college')} /></label><label className="block space-y-1.5 text-sm font-medium text-slate-700">Course<input className="inp" placeholder="Your course" value={f.course} onChange={s('course')} /></label></div>}
    {err && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{err}</p>}
    <button className="btn-p w-full">Create account <ArrowRight size={16} /></button></form>
    <p className="auth-form-footer mt-5 border-t pt-4 text-sm text-slate-500">Already have an account? <Link className="font-semibold" to="/login">Sign in</Link></p></Wrap>
}
