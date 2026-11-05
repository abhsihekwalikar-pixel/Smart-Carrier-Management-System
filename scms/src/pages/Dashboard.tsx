import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Award, BadgeCheck, Bell, BriefcaseBusiness, Check, ChevronRight, CircleUserRound, FileCheck2, FileText, GraduationCap, Plus, Sparkles, Users, WandSparkles } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { BrandLogo } from '../ui'

type ProfileData = { headline: string; bio: string; phone: string; location: string; skills: string[] }
type DetailsData = { name?: string; industry?: string; website?: string; address?: string; status?: string; college?: string; course?: string }
type ResumeData = { id: string; title: string; created: string; versions: number }[]
type PortfolioData = { id: string; title: string; slug: string; published: boolean }[]
type DocumentData = { verification_id: string; kind: string; issued: string; issued_by?: string; student?: string; revoked: boolean }[]
type NotificationData = { id: string; message: string; read: boolean; time: string }[]
type DashboardData = {
  profile: ProfileData
  details: DetailsData
  resumes?: ResumeData
  portfolios?: PortfolioData
  documents?: DocumentData
  students?: { id: string }[]
  templateCount?: number
  notifications: NotificationData
}

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (!('IntersectionObserver' in window)) {
      element.classList.add('dashboard-reveal-visible')
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.classList.add('dashboard-reveal-visible')
        observer.unobserve(element)
      }
    }, { threshold: 0.12 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className={`dashboard-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { user } = useAuth()
  const isStudent = user?.role === 'student'
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        await api('/auth/me')
        const [profile, details] = await Promise.all([
          api<ProfileData>('/profile'),
          api<DetailsData>('/details')
        ])
        let next: DashboardData = { profile, details, notifications: [] }
        if (isStudent) {
          const [resumes, portfolios, documents, notifications] = await Promise.all([
            api<ResumeData>('/resumes'),
            api<PortfolioData>('/portfolios'),
            api<DocumentData>('/student/documents'),
            api<NotificationData>('/notifications')
          ])
          next = { ...next, resumes, portfolios, documents, notifications }
        } else if (details.status === 'approved') {
          const [documents, students, certificates, offers, notifications] = await Promise.all([
            api<DocumentData>('/org/documents'),
            api<{ id: string }[]>('/org/students'),
            api<{ id: string }[]>('/org/templates/certificate'),
            api<{ id: string }[]>('/org/templates/offer_letter'),
            api<NotificationData>('/notifications')
          ])
          next = { ...next, documents, students, templateCount: certificates.length + offers.length, notifications }
        } else {
          next.notifications = await api<NotificationData>('/notifications')
        }
        if (active) setData(next)
      } catch (e) {
        if (active) setError((e as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [isStudent])

  const profileChecks = isStudent
    ? [Boolean(data?.profile.headline), Boolean(data?.profile.bio), Boolean(data?.profile.phone || data?.profile.location), Boolean(data?.profile.skills?.length), Boolean(data?.resumes?.length)]
    : [Boolean(data?.details.name), Boolean(data?.details.industry), Boolean(data?.details.website), Boolean(data?.details.address), Boolean(data?.profile.phone)]
  const profilePercent = data ? Math.round(profileChecks.filter(Boolean).length / profileChecks.length * 100) : 0
  const status = data?.details.status || user?.organization?.status || 'pending'
  const pendingOrganization = !isStudent && status !== 'approved'
  const metrics = isStudent
    ? [
      { label: 'Resumes', value: data?.resumes?.length ?? 0, note: 'Career versions', icon: FileText, tone: 'sage' },
      { label: 'Published portfolios', value: data?.portfolios?.filter(p => p.published).length ?? 0, note: 'Public profiles', icon: BriefcaseBusiness, tone: 'lime' },
      { label: 'Credentials', value: data?.documents?.length ?? 0, note: 'Issued to you', icon: Award, tone: 'peach' }
    ]
    : [
      { label: 'Documents issued', value: data?.documents?.length ?? 0, note: 'Certificates and offers', icon: FileCheck2, tone: 'sage' },
      { label: 'Students reached', value: data?.students?.length ?? 0, note: 'Registered students', icon: Users, tone: 'lime' },
      { label: 'Templates', value: data?.templateCount ?? 0, note: 'Ready to issue', icon: Award, tone: 'peach' }
    ]
  const quickActions = isStudent
    ? [
      { title: 'Build your resume', text: 'Create or update your experience.', to: '/app/resumes', icon: FileText, tone: 'sage' },
      { title: 'Shape your portfolio', text: 'Publish a profile worth sharing.', to: '/app/portfolios', icon: BriefcaseBusiness, tone: 'lime' },
      { title: 'View credentials', text: 'Find documents issued to you.', to: '/app/my-documents', icon: Award, tone: 'peach' }
    ]
    : [
      { title: 'Create a template', text: 'Prepare a certificate or offer letter.', to: '/app/certificate-templates', icon: FileText, tone: 'sage' },
      { title: 'Issue a document', text: 'Recognize a student achievement.', to: '/app/generate', icon: Plus, tone: 'lime' },
      { title: 'Browse students', text: 'Find students in the SCMS network.', to: '/app/students', icon: GraduationCap, tone: 'peach' }
    ]

  return <div className="dashboard-page">
    <section className="dashboard-hero">
      <div className="dashboard-hero-orb dashboard-hero-orb-one" />
      <div className="dashboard-hero-orb dashboard-hero-orb-two" />
      <div className="dashboard-hero-content">
        <div className="dashboard-hero-copy">
          <div className="dashboard-overline"><span />{isStudent ? 'STUDENT WORKSPACE' : 'ORGANIZATION WORKSPACE'}</div>
          <h1>{getGreeting()},<br /><span>{user?.name || 'there'}.</span></h1>
          <p>{isStudent ? 'Your next opportunity starts with a story that shows what you can do.' : 'Make every student achievement easier to recognize and trust.'}</p>
          {pendingOrganization ? <div className={`dashboard-status-note ${status === 'rejected' ? 'dashboard-status-rejected' : ''}`}><span className="dashboard-status-pulse" />{status === 'rejected' ? 'Your organization application needs attention.' : 'Your organization is being reviewed. Issuing tools will unlock after approval.'}</div>
            : <Link to={isStudent ? '/app/resumes' : '/app/generate'} className="dashboard-hero-cta">{isStudent ? 'Keep building' : 'Issue a document'}<ArrowUpRight size={16} /></Link>}
        </div>
        <div className="dashboard-hero-art" aria-hidden="true">
          <div className="dashboard-art-ring dashboard-art-ring-one" />
          <div className="dashboard-art-ring dashboard-art-ring-two" />
          <div className="dashboard-art-card">
            <div className="dashboard-art-card-top"><span className="dashboard-art-logo"><BrandLogo /></span><span className="dashboard-art-dots"><i /><i /><i /></span></div>
            <div className="dashboard-art-avatar">{user?.name?.slice(0, 1).toUpperCase() || 'S'}</div>
            <div className="dashboard-art-lines"><span /><span /><span /></div>
            <div className="dashboard-art-badge"><BadgeCheck size={14} /> SCMS VERIFIED</div>
          </div>
          <div className="dashboard-art-float dashboard-art-float-top"><span><Check size={14} /></span>{isStudent ? 'Your story, in progress' : 'Trusted credentials'}</div>
          <div className="dashboard-art-float dashboard-art-float-bottom"><WandSparkles size={15} /> Small steps. Real momentum.</div>
        </div>
      </div>
      <div className="dashboard-hero-bottom"><span>YOUR WORKSPACE, AT A GLANCE</span><span>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span></div>
    </section>

    {error && <div role="alert" className="dashboard-error">{error}</div>}

    <section className="dashboard-metrics" aria-label="Workspace overview">
      {metrics.map((metric, index) => <Reveal key={metric.label} delay={index * 90}>
        <article className={`dashboard-metric dashboard-metric-${metric.tone}`}>
          <div className="dashboard-metric-top"><span className="dashboard-metric-icon"><metric.icon size={18} /></span><ArrowUpRight size={15} className="dashboard-metric-arrow" /></div>
          <p>{metric.label}</p>
          <div className="dashboard-metric-value">{loading ? <span className="dashboard-skeleton" /> : metric.value}</div>
          <span className="dashboard-metric-note">{metric.note}</span>
        </article>
      </Reveal>)}
      <Reveal delay={270}>
        <article className="dashboard-progress-card">
          <div className="dashboard-progress-heading"><span className="dashboard-progress-icon"><CircleUserRound size={18} /></span><span>Profile strength</span><strong>{loading ? '—' : `${profilePercent}%`}</strong></div>
          <div className="dashboard-progress-track"><span style={{ width: loading ? '0%' : `${profilePercent}%` }} /></div>
          <p>{loading ? 'Checking your profile…' : profilePercent === 100 ? 'Your profile looks complete.' : 'A few details can make your profile stand out.'}</p>
          <Link to="/app/profile">Complete profile <ArrowRight size={14} /></Link>
        </article>
      </Reveal>
    </section>

    <section className="dashboard-section">
      <Reveal className="dashboard-section-heading"><div><p className="dashboard-section-kicker">A good place to start</p><h2>Move your story forward.</h2></div><span className="dashboard-section-aside">QUICK ACTIONS <ArrowDownRightIcon /></span></Reveal>
      <div className="dashboard-quick-grid">
        {quickActions.map((action, index) => <Reveal key={action.title} delay={index * 90}>
          <Link to={pendingOrganization ? '/app/profile' : action.to} className={`dashboard-action dashboard-action-${action.tone}`}>
            <div className="dashboard-action-top"><span><action.icon size={19} /></span><ArrowUpRight size={16} className="dashboard-action-arrow" /></div>
            <h3>{action.title}</h3><p>{pendingOrganization ? 'Complete your organization profile while your application is reviewed.' : action.text}</p>
            <div className="dashboard-action-link">{pendingOrganization ? 'Review profile' : 'Open workspace'}<ChevronRight size={14} /></div>
          </Link>
        </Reveal>)}
      </div>
    </section>

    <section className="dashboard-bottom-grid">
      <Reveal className="dashboard-next-card">
        <div className="dashboard-next-copy"><p className="dashboard-section-kicker">{isStudent ? 'YOUR NEXT STEP' : 'MAKE IT COUNT'}</p><h2>{isStudent ? 'Your experience deserves a great introduction.' : 'Turn recognition into something lasting.'}</h2><p>{isStudent ? 'Start with one skill, project, or achievement. You can build the rest as you go.' : 'Prepare a reusable template, then issue a professional document in just a few steps.'}</p><Link to={pendingOrganization ? '/app/profile' : isStudent ? '/app/resumes' : '/app/certificate-templates'}>{pendingOrganization ? 'Update organization details' : isStudent ? 'Start a resume' : 'Prepare a template'}<ArrowRight size={15} /></Link></div>
        <div className="dashboard-next-illustration"><div className="dashboard-next-disc"><Sparkles size={25} /></div><span className="dashboard-next-orbit" /><span className="dashboard-next-star">✳</span></div>
      </Reveal>
      <Reveal className="dashboard-activity-card" delay={100}>
        <div className="dashboard-activity-heading"><div><p className="dashboard-section-kicker">STAY IN THE LOOP</p><h2>Recent updates</h2></div><Bell size={17} /></div>
        {loading ? <div className="dashboard-activity-empty">Loading updates…</div> : data?.notifications.length ? <div className="dashboard-activity-list">{data.notifications.slice(0, 3).map((notification, index) => <div key={notification.id} className="dashboard-activity-item"><span className={`dashboard-activity-dot ${notification.read ? '' : 'dashboard-activity-dot-new'}`} /><div><p>{notification.message}</p><span>{new Date(notification.time).toLocaleDateString()}</span></div>{index === 0 && <span className="dashboard-activity-icon"><Bell size={14} /></span>}</div>)}</div> : <div className="dashboard-activity-empty"><span><Bell size={18} /></span><p>You’re all caught up.</p><small>New updates will show here.</small></div>}
        <Link to="/app/notifications" className="dashboard-activity-link">View notifications <ArrowRight size={14} /></Link>
      </Reveal>
    </section>
  </div>
}

function ArrowDownRightIcon() {
  return <ArrowRight size={13} />
}
