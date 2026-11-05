import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Award, BadgeCheck, BriefcaseBusiness, Check, FileCheck2, GraduationCap, MoveUpRight, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../auth'
import { BrandLogo } from '../ui'

const features = [
  {
    icon: BriefcaseBusiness,
    number: '01',
    title: 'Tell your story',
    detail: 'Shape your experience into a resume and portfolio that feel like you.',
    tone: 'mint'
  },
  {
    icon: Award,
    number: '02',
    title: 'Make milestones matter',
    detail: 'Create and manage certificates and offer letters in one place.',
    tone: 'lime'
  },
  {
    icon: ShieldCheck,
    number: '03',
    title: 'Prove what you have done',
    detail: 'Let anyone verify a credential with a unique ID or QR code.',
    tone: 'peach'
  }
] as const

export default function Landing() {
  const { user, ready } = useAuth()
  const homeTo = ready && user ? '/app' : '/'
  const actionTo = ready && user ? '/app' : '/register'
  const actionLabel = ready && user ? 'Go to dashboard' : 'Create your account'
  return <div className="landing-page min-h-screen overflow-hidden">
    <header className="landing-nav">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link to={homeTo} className="landing-brand" aria-label={user ? 'Go to dashboard home' : 'SCMS home'}>
          <span className="landing-brand-mark"><BrandLogo /></span>
          <span>scms<span className="landing-brand-period">.</span></span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3">
          <Link to="/verify" className="landing-nav-link hidden sm:inline-flex">Verify a document</Link>
          {ready ? <Link to={user ? '/app' : '/login'} className="landing-nav-link">{user ? 'Dashboard' : 'Sign in'}</Link> : <span className="landing-nav-link" aria-live="polite">Checking session…</span>}
          {(!ready || !user) && <Link to="/register" className="landing-nav-cta">Get started <ArrowUpRight size={16} /></Link>}
        </nav>
      </div>
    </header>

    <main>
      <section className="landing-hero">
        <div className="landing-hero-glow landing-hero-glow-one" />
        <div className="landing-hero-glow landing-hero-glow-two" />
        <div className="landing-hero-grid mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[1.03fr_.97fr] lg:gap-16 lg:pb-28 lg:pt-20">
          <div className="landing-copy">
            <div className="landing-eyebrow"><span className="landing-eyebrow-dot" />A career platform for what comes next</div>
            <h1>Make your work<br /> <span>mean more.</span></h1>
            <p className="landing-lede">Build a career story you’re proud to share. Keep your portfolio, professional documents, and verified achievements together in one place.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={actionTo} className="landing-primary-cta">{actionLabel} <MoveUpRight size={17} /></Link>
              <Link to="/verify" className="landing-secondary-cta"><ShieldCheck size={17} /> Verify a document</Link>
            </div>
            <div className="landing-trust-row">
              <div className="landing-trust-icon"><GraduationCap size={17} /></div>
              <p>For students building their future <span /> and organizations recognizing talent</p>
            </div>
          </div>

          <div className="landing-visual" aria-label="Preview of a verified career profile">
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />
            <div className="landing-preview-card">
              <div className="landing-preview-top">
                <span className="landing-preview-label"><span /> SCMS CAREER PROFILE</span>
                <span className="landing-preview-menu"><i /><i /><i /></span>
              </div>
              <div className="landing-profile">
                <div className="landing-avatar">AK<span className="landing-avatar-check"><Check size={12} strokeWidth={3} /></span></div>
                <div className="min-w-0 flex-1">
                  <p className="landing-profile-kicker">YOUR NEXT CHAPTER</p>
                  <h2>Abhishek’s career story</h2>
                  <p className="landing-profile-subtitle">A profile ready to grow</p>
                </div>
                <span className="landing-profile-arrow"><ArrowUpRight size={17} /></span>
              </div>
              <div className="landing-progress">
                <div className="flex items-center justify-between"><span>Profile progress</span><strong>In progress</strong></div>
                <div className="landing-progress-track"><span /></div>
                <div className="landing-progress-labels"><span>Resume</span><span>Portfolio</span><span>Credentials</span></div>
              </div>
              <div className="landing-credential">
                <div className="landing-credential-icon"><Award size={19} /></div>
                <div className="min-w-0 flex-1"><p>Achievement certificate</p><span>Ready to share</span></div>
                <span className="landing-credential-status"><BadgeCheck size={16} /> Verified</span>
              </div>
              <div className="landing-preview-footer"><span className="landing-footer-check"><Check size={13} strokeWidth={3} /></span><span>One workspace. A story that’s yours.</span></div>
            </div>
            <div className="landing-float-note"><span className="landing-float-icon"><FileCheck2 size={17} /></span><span><strong>Easy to verify</strong><small>Credentials with confidence</small></span><ArrowUpRight size={15} className="ml-auto text-[#52766c]" /></div>
            <span className="landing-spark landing-spark-one">✳</span>
            <span className="landing-spark landing-spark-two">✳</span>
          </div>
        </div>

        <div className="landing-manifesto">
          <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 sm:grid-cols-3 sm:px-8">
            <div><span className="landing-manifesto-mark">01</span><span>Build a profile that feels like you</span></div>
            <div><span className="landing-manifesto-mark">02</span><span>Keep every milestone close</span></div>
            <div><span className="landing-manifesto-mark">03</span><span>Share achievements people can trust</span></div>
          </div>
        </div>
      </section>

      <section className="landing-features mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="landing-features-heading">
          <div>
            <p className="landing-section-kicker">A little more momentum</p>
            <h2>Your progress,<br className="sm:hidden" /> all in one place.</h2>
          </div>
          <p>From the first draft of your resume to a credential someone can verify, SCMS helps you bring the pieces of your career story together.</p>
        </div>
        <div className="mt-11 grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, number, title, detail, tone }) => <article key={number} className={`landing-feature-card landing-feature-${tone}`}>
            <div className="flex items-start justify-between"><span className="landing-feature-icon"><Icon size={20} /></span><span className="landing-feature-number">{number}</span></div>
            <h3>{title}</h3>
            <p>{detail}</p>
            <span className="landing-feature-line"><span /></span>
          </article>)}
        </div>
        <div className="landing-bottom-cta">
          <div><p>Ready when you are</p><h3>Give your next step a little more intention.</h3></div>
          <Link to={actionTo}>{ready && user ? 'Go to your dashboard' : 'Start your profile'} <ArrowRight size={17} /></Link>
          <ArrowDownRight className="landing-cta-decoration" size={88} strokeWidth={0.8} />
        </div>
      </section>
    </main>

    <footer className="landing-footer">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8"><Link to={homeTo} className="landing-brand landing-footer-brand"><span className="landing-brand-mark"><BrandLogo /></span><span>scms<span className="landing-brand-period">.</span></span></Link><p>Smart Career Management System <span>·</span> A better way to show how far you’ve come.</p><Link to="/verify" className="landing-footer-link">Verify a document <ArrowUpRight size={14} /></Link></div>
    </footer>
  </div>
}
