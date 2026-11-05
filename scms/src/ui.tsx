import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export const BrandLogo = ({ className = '' }: { className?: string }) => <img className={`brand-logo ${className}`} src="/scms-logo.png" alt="" aria-hidden="true" />

export const Err = ({ m }: { m: string }) => m ? <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{m}</p> : null
export const Ok = ({ m }: { m: string }) => m ? <p className="mb-3 rounded-lg bg-green-50 p-2 text-sm text-green-700">{m}</p> : null
export const Empty = ({ t }: { t: string }) => <div className="card text-center text-sm text-slate-500">{t}</div>
export const fdate = (s: string) => new Date(s + 'Z').toLocaleDateString()
export const PageHeading = ({ title, subtitle, action, eyebrow = 'CAREER WORKSPACE' }: { title: string; subtitle: string; action?: ReactNode; eyebrow?: string }) => (
  <div className="workspace-page-heading">
    <span className="workspace-page-heading-mark" aria-hidden="true"><Sparkles size={20} /></span>
    <div className="min-w-0">
      <span className="workspace-page-heading-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
    {action && <div className="workspace-page-heading-action">{action}</div>}
  </div>
)
export const SiteFooter = ({ homeTo = '/' }: { homeTo?: string }) => (
  <footer className="site-footer">
    <Link to={homeTo} className="site-footer-brand"><span className="site-footer-mark"><BrandLogo /></span><span>SCMS<span>.</span></span></Link>
    <p>Smart Career Management System <span>·</span> Build your future, one step at a time.</p>
    <div className="site-footer-links"><Link to="/verify">Verify a document</Link><span>© 2026 SCMS</span></div>
  </footer>
)
