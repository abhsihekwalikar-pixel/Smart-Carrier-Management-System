import { useState } from 'react'
import { Activity, Building2, Check, CircleCheck, Clock3, FileCheck2, FileText, GraduationCap, LogIn, LogOut, Search, Settings2, ShieldCheck, UserCog, UserPlus, UserRound, Users, X } from 'lucide-react'
import { api, useApi } from '../api'
import { useAuth } from '../auth'
import { PageHeading } from '../ui'
const Empty = ({ t }: { t: string }) => <div className="card text-center text-sm text-slate-500">{t}</div>
const Err = ({ m }: { m: string }) => m ? <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{m}</p> : null
type AuditEvent = { id: string; time: string; actor: string; action: string; detail: string }
const AUDIT_ACTIONS: Record<string, { title: string; description: string; category: string }> = {
  LOGIN: { title: 'Signed in', description: 'Started an authenticated SCMS session.', category: 'Access' },
  LOGOUT: { title: 'Signed out', description: 'Ended an SCMS session.', category: 'Access' },
  REGISTER: { title: 'Account created', description: 'Registered a new account on the platform.', category: 'Accounts' },
  ORG_APPROVED: { title: 'Organization approved', description: 'Approved an organization to use its workspace.', category: 'Organizations' },
  ORG_REJECTED: { title: 'Organization rejected', description: 'Rejected an organization application.', category: 'Organizations' },
  USER_ACTIVATE: { title: 'Account activated', description: 'Restored a user account’s access to SCMS.', category: 'Accounts' },
  USER_DEACTIVATE: { title: 'Account deactivated', description: 'Disabled a user account’s access to SCMS.', category: 'Accounts' },
  ROLE_CHANGE: { title: 'Workspace role changed', description: 'Updated a user’s role and workspace permissions.', category: 'Access' },
  RBAC_UPDATE: { title: 'Permission updated', description: 'Changed a role’s access to a platform capability.', category: 'Access' },
  PROFILE_UPDATE: { title: 'Profile updated', description: 'Saved changes to a user profile.', category: 'Profiles' },
  DETAILS_UPDATE: { title: 'Account details updated', description: 'Saved changes to account or organization details.', category: 'Profiles' },
  TEMPLATE_CREATE: { title: 'Template created', description: 'Created a reusable document template.', category: 'Templates' },
  TEMPLATE_UPDATE: { title: 'Template updated', description: 'Edited a document template.', category: 'Templates' },
  TEMPLATE_DELETE: { title: 'Template deleted', description: 'Removed a document template.', category: 'Templates' },
  ADMIN_TEMPLATE_DELETE: { title: 'Template removed by admin', description: 'A platform administrator removed an organization template.', category: 'Templates' },
  DOC_ISSUE: { title: 'Document issued', description: 'Issued a certificate or offer letter to a student.', category: 'Documents' },
  DOC_BULK: { title: 'Bulk documents processed', description: 'Processed a batch of certificate or offer-letter requests.', category: 'Documents' },
  DOC_REVOKE: { title: 'Document revoked', description: 'Revoked an issued credential so it no longer verifies as valid.', category: 'Documents' },
  AI_CONFIG: { title: 'AI settings updated', description: 'Changed the platform’s AI feature configuration.', category: 'Settings' },
  RESUME_CREATE: { title: 'Resume created', description: 'Created a resume in the career workspace.', category: 'Career profiles' },
  RESUME_UPDATE: { title: 'Resume updated', description: 'Saved a new version of a resume.', category: 'Career profiles' },
  RESUME_DELETE: { title: 'Resume deleted', description: 'Removed a resume from the career workspace.', category: 'Career profiles' },
  RESUME_UPLOAD: { title: 'Resume uploaded', description: 'Uploaded a resume to the career workspace.', category: 'Career profiles' },
  PORTFOLIO_CREATE: { title: 'Portfolio created', description: 'Created a portfolio for sharing career achievements.', category: 'Career profiles' },
  PORTFOLIO_PUBLISH: { title: 'Portfolio published', description: 'Published a portfolio so it can be shared publicly.', category: 'Career profiles' },
  PORTFOLIO_UPDATE: { title: 'Portfolio updated', description: 'Saved changes to a portfolio.', category: 'Career profiles' },
  PORTFOLIO_DELETE: { title: 'Portfolio deleted', description: 'Removed a portfolio from the career workspace.', category: 'Career profiles' }
}
const auditAction = (action: string) => AUDIT_ACTIONS[action] || { title: action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()), description: 'Recorded an administrative or workspace activity.', category: 'Activity' }
const auditIcon = (action: string) => action === 'LOGIN' ? LogIn : action === 'LOGOUT' ? LogOut : action === 'REGISTER' ? UserPlus : action.startsWith('DOC_') ? FileCheck2 : action.includes('TEMPLATE') || action.startsWith('RESUME_') || action.startsWith('PORTFOLIO_') ? FileText : action.startsWith('USER_') || action === 'ROLE_CHANGE' ? UserCog : action === 'RBAC_UPDATE' || action === 'AI_CONFIG' ? Settings2 : action.startsWith('ORG_') ? Building2 : action.includes('PROFILE') || action.includes('DETAILS') ? UserRound : Activity
export function AdminDash() {
  const { data, error } = useApi<AdminAnalyticsData>('/admin/analytics')
  const stats: [string, keyof Omit<AdminAnalyticsData, 'activity_trend'>][] = [['Users', 'users'], ['Students', 'students'], ['Approved organizations', 'organizations_approved'], ['Pending approvals', 'organizations_pending'], ['Documents issued', 'documents_issued'], ['Portfolios published', 'portfolios_published']]
  const trend = data?.activity_trend || []
  const scaleMax = Math.max(4, Math.ceil(Math.max(0, ...trend.map(point => point.events), ...trend.map(point => point.accounts)) / 4) * 4)
  const plot = (key: 'events' | 'accounts') => trend.map((point, index) => ({
    ...point,
    x: 52 + index * (684 / Math.max(1, trend.length - 1)),
    y: 22 + 166 * (1 - point[key] / scaleMax)
  }))
  const activityPoints = plot('events')
  const accountPoints = plot('accounts')
  const pathFor = (points: { x: number; y: number }[]) => points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const activityPath = pathFor(activityPoints)
  const accountPath = pathFor(accountPoints)
  const activityArea = activityPoints.length ? `${activityPath} L ${activityPoints[activityPoints.length - 1].x} 188 L ${activityPoints[0].x} 188 Z` : ''
  const chartTicks = Array.from({ length: 5 }, (_, index) => scaleMax - scaleMax * index / 4)
  const activityTotal = trend.reduce((sum, point) => sum + point.events, 0)
  const accountTotal = trend.reduce((sum, point) => sum + point.accounts, 0)
  const dateLabel = (value: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
  return <div className="admin-analytics-page"><PageHeading title="Platform analytics" subtitle="A live view of activity across the SCMS ecosystem." eyebrow="ADMIN OVERVIEW" /><Err m={error} />
    <div className="admin-analytics-stats">{stats.map(([label, key]) => <article key={key} className="admin-analytics-stat"><span>{label}</span><strong>{data ? data[key] : '–'}</strong></article>)}</div>
    <section className="admin-analytics-chart">
      <header className="admin-analytics-chart-header">
        <div><span className="admin-analytics-kicker"><Activity size={13} /> LIVE PLATFORM PULSE</span><h2>Activity over time</h2><p>Daily recorded actions and newly created accounts across the last 14 days.</p></div>
        <span className="admin-analytics-range">LAST 14 DAYS</span>
      </header>
      <div className="admin-analytics-chart-legend">
        <span><i className="admin-analytics-legend-events" />Recorded actions <strong>{activityTotal}</strong></span>
        <span><i className="admin-analytics-legend-accounts" />New accounts <strong>{accountTotal}</strong></span>
      </div>
      {data ? <div className="admin-analytics-plot-wrap"><svg className="admin-analytics-plot" viewBox="0 0 760 234" role="img" aria-label="Daily recorded actions and new accounts over the last 14 days">
        <defs><linearGradient id="activity-area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2f6449" stopOpacity=".19" /><stop offset="100%" stopColor="#2f6449" stopOpacity="0" /></linearGradient></defs>
        {chartTicks.map((tick, index) => { const y = 22 + 166 * index / 4; return <g key={tick}><line x1="52" x2="736" y1={y} y2={y} className="admin-analytics-gridline" /><text x="40" y={y + 3} textAnchor="end" className="admin-analytics-y-label">{tick}</text></g> })}
        {activityPoints.length > 0 && <path d={activityArea} fill="url(#activity-area-fill)" />}
        {activityPoints.length > 1 && <path d={activityPath} className="admin-analytics-line-events" />}
        {accountPoints.length > 1 && <path d={accountPath} className="admin-analytics-line-accounts" />}
        {activityPoints.map((point, index) => <g key={point.date}>
          <title>{dateLabel(point.date)}: {point.events} recorded actions, {point.accounts} new accounts</title>
          {(index % 2 === 0 || index === activityPoints.length - 1) && <text x={point.x} y="218" textAnchor="middle" className="admin-analytics-x-label">{dateLabel(point.date)}</text>}
          <circle cx={point.x} cy={point.y} r="3.5" className="admin-analytics-dot-events" />
          <circle cx={accountPoints[index].x} cy={accountPoints[index].y} r="3.5" className="admin-analytics-dot-accounts" />
        </g>)}
      </svg></div> : <div className="admin-analytics-chart-loading">{error ? 'The activity trend could not be loaded.' : 'Loading live activity data…'}</div>}
      <footer className="admin-analytics-chart-foot"><span>Actions are counted from recorded SCMS activity logs.</span><span>Account growth is counted from registered user records.</span></footer>
    </section>
  </div>
}
export function AdminOrgs() {
  const { data, error, reload } = useApi<{ id: string; name: string; status: string; email: string; industry: string; website: string; address: string }[]>('/admin/organizations'); const [err, setErr] = useState('')
  const act = async (id: string, status: string) => { try { await api(`/admin/organizations/${id}/status`, 'POST', { status }); setErr(''); reload() } catch (e) { setErr((e as Error).message) } }
  return <div><PageHeading title="Organizations" subtitle="Review organization profiles and manage their access." /><Err m={error || err} />{data && data.length === 0 ? <Empty t="No organizations have registered yet." /> : data &&
    <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Organization</th><th>Contact</th><th>Industry</th><th>Website / address</th><th>Status</th><th className="pr-3 text-right">Review</th></tr></thead><tbody>
      {data.map(o => <tr key={o.id} className="border-t"><td className="min-w-48 p-3 font-medium">{o.name}</td><td className="min-w-44 text-slate-600">{o.email}</td><td className="min-w-40 text-slate-600">{o.industry || '—'}</td>
        <td className="min-w-48 text-slate-600">{o.website && <a className="block text-brand-700 hover:underline" href={o.website} target="_blank" rel="noreferrer">{o.website.replace(/^https?:\/\//, '')}</a>}{o.address && <span className="mt-1 block text-xs text-slate-500">{o.address}</span>}{!o.website && !o.address && '—'}</td>
        <td><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${o.status === 'approved' ? 'bg-green-50 text-green-700' : o.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{o.status}</span></td>
        <td className="space-x-2 whitespace-nowrap pr-3 text-right">{o.status !== 'approved' && <button className="btn-p py-1" onClick={() => act(o.id, 'approved')}><Check size={14} />Approve</button>}{o.status !== 'rejected' && <button className="btn-d py-1" onClick={() => act(o.id, 'rejected')}><X size={14} />Reject</button>}</td></tr>)}</tbody></table></div>}</div>
}
type AdminAnalyticsData = {
  users: number
  students: number
  organizations_approved: number
  organizations_pending: number
  documents_issued: number
  portfolios_published: number
  activity_trend: { date: string; events: number; accounts: number }[]
}
export function AdminUsers() {
  const { user } = useAuth(); const { data, error, reload } = useApi<{ id: string; name: string; email: string; role: string; active: boolean }[]>('/admin/users'); const [err, setErr] = useState('')
  const [query, setQuery] = useState('')
  const patch = async (id: string, b: object) => { try { await api('/admin/users/' + id, 'PATCH', b); setErr(''); reload() } catch (e) { setErr((e as Error).message); reload() } }
  const users = data || []
  const visibleUsers = users.filter(account => `${account.name} ${account.email} ${account.role}`.toLowerCase().includes(query.trim().toLowerCase()))
  const activeCount = users.filter(account => account.active).length
  const roleStats = [
    { label: 'Total accounts', value: users.length, icon: Users, tone: 'forest' },
    { label: 'Active accounts', value: activeCount, icon: CircleCheck, tone: 'lime' },
    { label: 'Students', value: users.filter(account => account.role === 'student').length, icon: GraduationCap, tone: 'sage' },
    { label: 'Organizations', value: users.filter(account => account.role === 'organization').length, icon: Building2, tone: 'gold' }
  ]
  const roleIcon = (role: string) => role === 'super_admin' ? ShieldCheck : role === 'organization' ? Building2 : GraduationCap
  const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return <div className="admin-users-page">
    <PageHeading title="Users" subtitle="Manage accounts and assign workspace roles." eyebrow="PEOPLE & ACCESS" action={<span className="admin-users-secure"><ShieldCheck size={15} /> Access controls</span>} />
    <Err m={error || err} />
    {data && <div className="admin-user-stats">{roleStats.map(({ label, value, icon: Icon, tone }) => <article key={label} className="admin-user-stat"><span className={`admin-user-stat-icon admin-user-stat-${tone}`}><Icon size={18} /></span><div><span>{label}</span><strong>{value}</strong></div></article>)}</div>}
    <section className="admin-users-panel">
      <div className="admin-users-toolbar"><div><h2>Account directory</h2><p>{data ? `${visibleUsers.length} of ${users.length} accounts shown` : 'Loading account records…'}</p></div>
        <label className="admin-users-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email or role" aria-label="Search users by name, email, or role" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</label>
      </div>
      {data && users.length === 0 ? <div className="admin-users-empty"><span><UserRound size={22} /></span><strong>No accounts yet</strong><p>Newly registered users will appear here.</p></div>
        : data && visibleUsers.length === 0 ? <div className="admin-users-empty"><span><Search size={22} /></span><strong>No matching accounts</strong><p>Try a different name, email, or role.</p></div>
          : <div className="admin-users-table-wrap"><table className="admin-users-table"><thead><tr><th>Account</th><th>Workspace role</th><th>Account status</th><th className="admin-users-actions-heading">Manage</th></tr></thead><tbody>
            {visibleUsers.map(account => {
              const isSelf = account.id === user?.id
              const RoleIcon = roleIcon(account.role)
              return <tr key={account.id}>
                <td><div className="admin-user-identity"><span className={`admin-user-avatar ${account.role === 'super_admin' ? 'admin-user-avatar-admin' : ''}`}>{initials(account.name) || 'U'}</span><span className="admin-user-copy"><strong>{account.name}{isSelf && <span className="admin-user-you">You</span>}</strong><span>{account.email}</span></span></div></td>
                <td><div className="admin-user-role-cell"><span className={`admin-user-role-icon admin-user-role-${account.role}`}><RoleIcon size={15} /></span><select className="inp admin-user-role-select" disabled={isSelf} aria-label={`Role for ${account.name}`} value={account.role} onChange={e => patch(account.id, { role: e.target.value })}>{['super_admin', 'organization', 'student'].map(role => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}</select>{isSelf && <span className="admin-user-locked">You</span>}</div></td>
                <td><span className={`admin-user-status ${account.active ? 'admin-user-status-active' : 'admin-user-status-disabled'}`}><i />{account.active ? 'Active' : 'Disabled'}</span></td>
                <td className="admin-users-actions"><button className={`admin-user-action ${account.active ? '' : 'admin-user-action-enable'}`} disabled={isSelf} onClick={() => patch(account.id, { active: !account.active })}>{account.active ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            })}</tbody></table></div>}
      {data && visibleUsers.length > 0 && <div className="admin-users-panel-foot"><span><ShieldCheck size={14} /> Your own administrator account can’t be changed here.</span><span>{activeCount} active <i /> {users.length - activeCount} disabled</span></div>}
    </section>
  </div>
}
export function AdminRbac() {
  const { data, error, reload } = useApi<{ roles: { id: string; name: string }[]; permissions: { id: string; key: string; roles: string[] }[] }>('/admin/rbac'); const [err, setErr] = useState('')
  const flip = async (role_id: string, permission_id: string, granted: boolean) => { try { await api('/admin/rbac', 'PUT', { role_id, permission_id, granted }); setErr(''); reload() } catch (e) { setErr((e as Error).message) } }
  return <div><PageHeading title="Roles & permissions" subtitle="Control what each role can access across SCMS." /><Err m={error || err} />
    {data && <><div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Permission</th>{data.roles.map(r => <th key={r.id} className="capitalize">{r.name.replace('_', ' ')}</th>)}</tr></thead><tbody>
      {data.permissions.map(p => <tr key={p.id} className="border-t"><td className="p-3 font-mono text-xs">{p.key}</td>{data.roles.map(r => <td key={r.id}><input type="checkbox" checked={p.roles.includes(r.id)} disabled={r.name === 'super_admin'} onChange={e => flip(r.id, p.id, e.target.checked)} /></td>)}</tr>)}</tbody></table></div>
      <p className="mt-2 text-xs text-slate-500">Super Admin permissions are locked. Changes take effect immediately on the server.</p></>}</div>
}
export function AdminAudit() {
  const [q, setQ] = useState('')
  const { data, error } = useApi<AuditEvent[]>('/admin/audit?q=' + encodeURIComponent(q))
  const events = data || []
  const accessEvents = events.filter(event => ['LOGIN', 'LOGOUT', 'REGISTER', 'ROLE_CHANGE', 'RBAC_UPDATE'].includes(event.action)).length
  const documentEvents = events.filter(event => event.action.startsWith('DOC_')).length
  const changeEvents = events.length - events.filter(event => ['LOGIN', 'LOGOUT'].includes(event.action)).length
  const stats = [
    { title: 'Activities shown', value: events.length, caption: 'Most recent records', icon: Activity, tone: 'forest' },
    { title: 'Access events', value: accessEvents, caption: 'Sign-ins, roles & permissions', icon: ShieldCheck, tone: 'sage' },
    { title: 'Document events', value: documentEvents, caption: 'Credentials & verification', icon: FileCheck2, tone: 'gold' },
    { title: 'Workspace changes', value: changeEvents, caption: 'Updates in this result set', icon: Settings2, tone: 'lime' }
  ]
  return <div className="admin-audit-page">
    <PageHeading title="Audit logs" subtitle="A clear, chronological record of important actions across your SCMS workspace." eyebrow="PLATFORM OVERSIGHT" action={<span className="admin-audit-secure"><ShieldCheck size={15} /> Admin activity</span>} />
    <Err m={error} />
    <div className="admin-audit-stats">{stats.map(({ title, value, caption, icon: Icon, tone }) => <article key={title} className="admin-audit-stat"><span className={`admin-audit-stat-icon admin-audit-stat-${tone}`}><Icon size={17} /></span><div><span>{title}</span><strong>{value}</strong><small>{caption}</small></div></article>)}</div>
    <section className="admin-audit-panel">
      <div className="admin-audit-toolbar"><div><h2>Activity history</h2><p>Events appear with the newest activity first.</p></div>
        <label className="admin-audit-search"><Search size={16} /><input placeholder="Search actor, action, or details" value={q} onChange={e => setQ(e.target.value)} aria-label="Search audit activity" />{q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={15} /></button>}</label>
      </div>
      {!data ? <div className="admin-audit-empty"><span><Activity size={22} /></span><strong>{error ? 'Activity could not be loaded' : 'Loading activity…'}</strong><p>{error ? 'Please try again in a moment.' : 'Fetching recent workspace records.'}</p></div>
        : events.length === 0 ? <div className="admin-audit-empty"><span><Activity size={22} /></span><strong>{q ? 'No matching activity' : 'No activity recorded yet'}</strong><p>{q ? 'Try another name, action, or detail.' : 'Important account and workspace events will appear here.'}</p></div>
        : <div className="admin-audit-table-wrap"><table className="admin-audit-table"><thead><tr><th>When</th><th>Description</th><th>Actor</th><th>Type</th><th>Record details</th></tr></thead><tbody>{events.map(event => {
          const meta = auditAction(event.action)
          const Icon = auditIcon(event.action)
          const timestamp = new Date(event.time + 'Z')
          return <tr key={event.id}>
            <td><span className="admin-audit-time"><strong>{timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong><span><Clock3 size={12} />{timestamp.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></span></td>
            <td><div className="admin-audit-description"><span className={`admin-audit-event-icon admin-audit-event-${meta.category.toLowerCase().replace(/[^a-z]+/g, '-')}`}><Icon size={15} /></span><span><strong>{meta.title}</strong><small>{meta.description}</small></span></div></td>
            <td><span className="admin-audit-actor"><i>{event.actor.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U'}</i><strong>{event.actor}</strong></span></td>
            <td><span className="admin-audit-category">{meta.category}</span></td>
            <td><span className="admin-audit-detail" title={event.detail}>{event.detail || '—'}</span><span className="admin-audit-code">{event.action}</span></td>
          </tr>
        })}</tbody></table></div>}
      {data && events.length > 0 && <div className="admin-audit-panel-foot"><span><ShieldCheck size={14} /> Audit records are read-only and shown newest first.</span><span>{events.length} {events.length === 1 ? 'event' : 'events'} <i /> Up to 300 recent records</span></div>}
    </section>
  </div>
}
export function AdminTemplates() {
  const { data, error, reload } = useApi<{ id: string; kind: string; name: string; organization: string; in_use: boolean }[]>('/admin/templates'); const [err, setErr] = useState('')
  const del = async (t: { id: string; kind: string; name: string }) => { if (!confirm(`Delete template "${t.name}"?`)) return; try { await api(`/admin/templates/${t.kind}/${t.id}`, 'DELETE'); setErr(''); reload() } catch (e) { setErr((e as Error).message) } }
  return <div><PageHeading title="Templates" subtitle="View and maintain document templates created by organizations." /><Err m={error || err} />{data && (data.length === 0 ? <Empty t="No templates have been created yet." /> :
    <div className="card overflow-x-auto p-0"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Name</th><th>Type</th><th>Organization</th><th>Issued docs</th><th /></tr></thead><tbody>{data.map(t => <tr key={t.kind + t.id} className="border-t"><td className="p-3">{t.name}</td><td className="capitalize">{t.kind.replace('_', ' ')}</td><td>{t.organization}</td><td>{t.in_use ? 'Yes' : 'No'}</td><td className="pr-3 text-right"><button className="btn-o py-1 text-red-600" disabled={t.in_use} title={t.in_use ? 'Has issued documents' : ''} onClick={() => del(t)}>Delete</button></td></tr>)}</tbody></table></div>)}</div>
}
export function AdminAI() {
  const { data, error } = useApi<{ enabled: boolean; tone: string }>('/admin/ai-config'); const [f, setF] = useState<{ enabled: boolean; tone: string } | null>(null); const [msg, setMsg] = useState(''), [err, setErr] = useState('')
  const v = f || data
  const save = async () => { try { await api('/admin/ai-config', 'PUT', v); setMsg('AI configuration saved.'); setErr('') } catch (e) { setErr((e as Error).message) } }
  return <div className="max-w-2xl"><PageHeading title="AI configuration" subtitle="Set the tone and availability of AI-assisted profile tools." /><div className="card max-w-lg space-y-3"><Err m={error || err} />{msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}
    {v && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.enabled} onChange={e => setF({ ...v, enabled: e.target.checked })} />Enable AI features (portfolio generation, resume enhancement)</label>
      <div><label className="text-sm font-medium">Writing tone</label><select className="inp mt-1" value={v.tone} onChange={e => setF({ ...v, tone: e.target.value })}><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="concise">Concise</option></select></div>
      <p className="text-xs text-slate-500">The generator is rule-based and runs on the server; no external AI provider or API key is used.</p><button className="btn-p" onClick={save}>Save</button></>}</div></div>
}
