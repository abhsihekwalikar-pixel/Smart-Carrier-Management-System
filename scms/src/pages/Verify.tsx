import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, BadgeCheck, CheckCircle2, FileCheck2, LockKeyhole, ScanSearch, ShieldCheck, XCircle } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { BrandLogo } from '../ui'
interface Rec { valid: boolean; revoked: boolean; doc_type: string; issued_to: string; issued_by: string; issued_on: string }
export default function Verify() {
  const { user } = useAuth()
  const homeTo = user ? '/app' : '/'
  const { id } = useParams(); const nav = useNavigate(); const [q, setQ] = useState(id || ''); const [rec, setRec] = useState<Rec | null>(null); const [err, setErr] = useState('')
  useEffect(() => { setRec(null); setErr(''); if (id) api<Rec>('/verify/' + encodeURIComponent(id), 'GET', undefined, false).then(setRec).catch(e => setErr(e.message)) }, [id])
  const submit = (e: FormEvent) => { e.preventDefault(); if (q.trim()) nav('/verify/' + encodeURIComponent(q.trim().toUpperCase())) }
  const formattedDate = rec ? new Date(rec.issued_on + 'Z').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  return <main className="verify-page">
    <header className="verify-nav"><Link to={homeTo} className="verify-brand" aria-label={user ? 'Go to dashboard home' : 'SCMS home'}><span className="verify-brand-mark"><BrandLogo /></span><span>SCMS<span>.</span></span></Link><Link to={homeTo} className="verify-back-link">{user ? 'Back to dashboard' : 'Back to home'} <ArrowRight size={14} /></Link></header>
    <section className="verify-hero">
      <div className="verify-hero-copy">
        <span className="verify-kicker"><span /> TRUSTED CREDENTIALS</span>
        <h1>Proof that speaks<br /><em>for itself.</em></h1>
        <p>Check whether an SCMS certificate or offer letter is authentic. No account needed — just the verification ID on the document.</p>
        <div className="verify-trust-note"><LockKeyhole size={15} /><span>Quick, secure, and publicly verifiable</span></div>
      </div>
      <div className="verify-visual" aria-hidden="true">
        <div className="verify-orbit verify-orbit-one" /><div className="verify-orbit verify-orbit-two" />
        <div className="verify-document-art"><div className="verify-doc-top"><span><ShieldCheck size={16} /></span><i>SCMS VERIFIED</i><BadgeCheck size={20} /></div><div className="verify-doc-line verify-doc-title" /><div className="verify-doc-line" /><div className="verify-doc-line verify-doc-short" /><div className="verify-doc-stamp"><CheckCircle2 size={26} /><span>AUTHENTIC</span></div><div className="verify-doc-foot"><span /><span /><span /></div></div>
        <div className="verify-float-tag"><ScanSearch size={15} /> Verification in seconds</div>
      </div>
    </section>
    <section className="verify-content">
      <div className="verify-check-card">
        <div className="verify-check-heading"><span className="verify-check-icon"><FileCheck2 size={19} /></span><div><h2>What would you like to verify?</h2><p>Enter the ID printed on the certificate or offer letter.</p></div></div>
        <form onSubmit={submit} className="verify-form">
          <label htmlFor="verification-id">Verification ID</label>
          <div className="verify-input-row"><input id="verification-id" className="inp" placeholder="Enter the ID from your document" value={q} onChange={e => setQ(e.target.value)} required autoComplete="off" /><button className="btn-p" type="submit">Check document <ArrowRight size={16} /></button></div>
          <p className="verify-input-hint">You can also open the verification link or scan the QR code printed on the document.</p>
        </form>
        {rec && !rec.revoked && <div className="verify-result verify-result-valid"><div className="verify-result-title"><CheckCircle2 size={22} /><div><strong>Document verified</strong><span>This credential is authentic and has not been revoked.</span></div></div><div className="verify-result-details"><div><span>DOCUMENT</span><strong>{rec.doc_type.replace('_', ' ')}</strong></div><div><span>ISSUED TO</span><strong>{rec.issued_to}</strong></div><div><span>ISSUED BY</span><strong>{rec.issued_by}</strong></div><div><span>ISSUED ON</span><strong>{formattedDate}</strong></div></div></div>}
        {rec?.revoked && <div className="verify-result verify-result-invalid"><div className="verify-result-title"><XCircle size={22} /><div><strong>Document revoked</strong><span>This credential is no longer valid. Contact the issuing organization if you need more information.</span></div></div><div className="verify-result-details"><div><span>DOCUMENT</span><strong>{rec.doc_type.replace('_', ' ')}</strong></div><div><span>ISSUED TO</span><strong>{rec.issued_to}</strong></div><div><span>ISSUED BY</span><strong>{rec.issued_by}</strong></div></div></div>}
        {err && <div className="verify-result verify-result-error"><div className="verify-result-title"><XCircle size={22} /><div><strong>We couldn’t verify that ID</strong><span>{err} Check the ID for typos, or ask the issuer for a fresh verification link.</span></div></div></div>}
      </div>
      <aside className="verify-help">
        <span className="verify-help-label">FIRST TIME HERE?</span><h2>It’s easy to check.</h2>
        <ol><li><span>01</span><div><strong>Find the ID</strong><p>Look near the bottom of the document, beside its QR code.</p></div></li><li><span>02</span><div><strong>Enter it above</strong><p>Type the verification ID exactly as it appears.</p></div></li><li><span>03</span><div><strong>Review the result</strong><p>Confirm the recipient, issuing organization, and document status.</p></div></li></ol>
        <div className="verify-help-foot"><ShieldCheck size={16} /><span>SCMS checks the record directly against the issuer’s verification registry.</span></div>
      </aside>
    </section>
    <footer className="verify-footer"><span>SCMS <i>·</i> Trusted achievements, clearly verified.</span><Link to="/">Explore SCMS <ArrowRight size={14} /></Link></footer>
  </main>
}
