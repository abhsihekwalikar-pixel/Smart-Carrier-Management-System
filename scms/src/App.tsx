import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Award, Bell, Briefcase, Building2, FileCheck2, FileText, FolderOpen, GraduationCap, History, LayoutDashboard, LogOut, Mail, Send, ShieldCheck, Users, UserCircle, Wand2 } from 'lucide-react'
import { useAuth } from './auth'
import type { RoleName } from './auth'
import Landing from './pages/Landing'
import { Login, Register } from './pages/AuthPages'
import Verify from './pages/Verify'
import { AdminDash, AdminOrgs, AdminUsers, AdminAudit, AdminRbac, AdminTemplates, AdminAI } from './pages/Admin'
import { Templates, Generate, Documents, OrgStudents } from './pages/Org'
import { Resumes, ResumeEditor, Portfolios, PortfolioEditor, MyDocuments, PublicPortfolio } from './pages/Student'
import Notifications from './pages/Notifications'
import ProfilePage from './pages/ProfilePage'
import Dashboard from './pages/Dashboard'
import { BrandLogo, SiteFooter } from './ui'

const NAV: Record<RoleName, { to: string; label: string; icon: any }[]> = {
  super_admin: [{ to: '/app', label: 'Analytics', icon: LayoutDashboard }, { to: '/app/organizations', label: 'Organizations', icon: Building2 }, { to: '/app/users', label: 'Users', icon: Users }, { to: '/app/rbac', label: 'RBAC', icon: ShieldCheck }, { to: '/app/audit', label: 'Audit Logs', icon: History }, { to: '/app/admin-templates', label: 'Templates', icon: FileText }, { to: '/app/ai-config', label: 'AI Config', icon: Wand2 }],
  organization: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard }, { to: '/app/profile', label: 'Org Profile', icon: Building2 }, { to: '/app/certificate-templates', label: 'Certificate Templates', icon: Award }, { to: '/app/offer-templates', label: 'Offer Templates', icon: Mail }, { to: '/app/generate', label: 'Generate', icon: Send }, { to: '/app/documents', label: 'Issued Documents', icon: FolderOpen }, { to: '/app/students', label: 'Students', icon: GraduationCap }],
  student: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard }, { to: '/app/profile', label: 'My Profile', icon: UserCircle }, { to: '/app/resumes', label: 'Resumes', icon: FileText }, { to: '/app/portfolios', label: 'Portfolios', icon: Briefcase }, { to: '/app/my-documents', label: 'My Documents', icon: FolderOpen }]
}
function Shell() {
  const { user, logout, ready } = useAuth()
  if (!ready) return <div className="p-10 text-slate-500">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  const nav = NAV[user.role]
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="app-sidebar hidden w-64 shrink-0 flex-col px-4 py-6 text-slate-300 md:flex">
        <Link to="/app" aria-label="Go to dashboard home" className="mb-9 flex items-center gap-3 px-3 text-lg font-bold tracking-tight text-white"><span className="app-brand-mark flex h-9 w-9 items-center justify-center rounded-xl"><BrandLogo /></span>SCMS<span className="ml-auto rounded-full border border-white/15 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/50">Portal</span></Link>
        <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
        <nav className="flex-1 space-y-1">
          {nav.map(n => <NavLink key={n.to} to={n.to} end={n.to === '/app'} className={({ isActive }) => `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive ? 'app-nav-active' : 'app-nav-link'}`}><n.icon size={17} className="opacity-80" />{n.label}</NavLink>)}
          <div className="my-4 border-t border-white/10" />
          <NavLink to="/app/notifications" className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive ? 'app-nav-active' : 'app-nav-link'}`}><Bell size={17} />Notifications</NavLink>
          <NavLink to="/verify" className="app-nav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition"><FileCheck2 size={17} />Verify document</NavLink>
        </nav>
        <div className="mt-6 border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <span className="app-user-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">{user.name.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 text-sm"><div className="truncate font-medium text-white">{user.name}</div><div className="text-xs capitalize text-slate-500">{user.role.replace('_', ' ')}</div></div>
          </div>
          <button onClick={logout} className="app-nav-link flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition"><LogOut size={16} />Sign out</button>
        </div>
      </aside>
      <div className="app-shell-main min-w-0 flex-1">
        <header className="app-topbar border-b px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link to="/app" className="flex items-center gap-2 font-bold tracking-tight text-slate-900 md:hidden"><span className="app-brand-mark flex h-8 w-8 items-center justify-center rounded-lg"><BrandLogo /></span>SCMS</Link>
            <div className="hidden text-sm md:block">Smart Career Management System <span className="mx-2 text-slate-300">/</span><span className="font-medium capitalize">{user.role.replace('_', ' ')}</span></div>
            <div className="flex items-center gap-2 text-sm text-slate-600 md:ml-auto"><span className="app-user-avatar-light flex h-8 w-8 items-center justify-center rounded-full font-semibold">{user.name.slice(0, 1).toUpperCase()}</span><span className="hidden font-medium sm:inline">{user.name}</span></div>
          </div>
          <nav className="-mb-3 mt-3 flex gap-1 overflow-x-auto pb-1 md:hidden">
            {[...nav, { to: '/app/notifications', label: 'Notifications', icon: Bell }, { to: '/verify', label: 'Verify', icon: FileCheck2 }].map(n => <NavLink key={n.to} to={n.to} end={n.to === '/app'} className={({ isActive }) => `app-mobile-nav-link flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${isActive ? 'app-mobile-nav-active' : ''}`}><n.icon size={15} />{n.label}</NavLink>)}
          </nav>
        </header>
        <main className="app-content min-w-0 flex-1 p-4 md:p-8"><Outlet /></main>
        <SiteFooter homeTo="/app" />
      </div>
    </div>
  )
}
function Home() {
  const { user } = useAuth()
  if (user?.role === 'super_admin') return <AdminDash />
  return <Dashboard />
}
export default function App() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="route-transition">
      <div className="route-transition__brand" aria-hidden="true">
        <span className="route-transition__sparkle"><BrandLogo /></span>
        <span className="route-transition__wordmark">SCMS</span>
        <span className="route-transition__caption">Career workspace</span>
      </div>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/p/:slug" element={<PublicPortfolio />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/verify/:id" element={<Verify />} />
        <Route path="/app" element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="organizations" element={<AdminOrgs />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="rbac" element={<AdminRbac />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin-templates" element={<AdminTemplates />} />
          <Route path="ai-config" element={<AdminAI />} />
          <Route path="certificate-templates" element={<Templates kind="certificate" />} />
          <Route path="offer-templates" element={<Templates kind="offer_letter" />} />
          <Route path="generate" element={<Generate />} />
          <Route path="documents" element={<Documents />} />
          <Route path="students" element={<OrgStudents />} />
          <Route path="resumes" element={<Resumes />} />
          <Route path="resumes/:id" element={<ResumeEditor />} />
          <Route path="portfolios" element={<Portfolios />} />
          <Route path="portfolios/:id" element={<PortfolioEditor />} />
          <Route path="my-documents" element={<MyDocuments />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
