import { Bell } from 'lucide-react'
import { api, useApi } from '../api'
import { PageHeading } from '../ui'
export default function Notifications() {
  const { data, error, reload } = useApi<{ id: string; message: string; read: boolean; time: string }[]>('/notifications')
  return <div className="max-w-4xl"><PageHeading title="Notifications" subtitle={data?.some(n => !n.read) ? 'You have unread updates waiting in your workspace.' : 'Stay up to date with activity in your workspace.'} action={data?.some(n => !n.read) && <button className="btn-o" onClick={() => api('/notifications/read-all', 'POST').then(reload)}>Mark all read</button>} />
    {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
    {data && (data.length === 0 ? <div className="card text-center text-slate-500"><Bell className="mx-auto mb-2" />You're all caught up.</div> : <div className="space-y-2">{data.map(n => <div key={n.id} className={`card py-3 text-sm ${n.read ? '' : 'border-brand-500'}`}>{n.message}<div className="text-xs text-slate-400">{new Date(n.time + 'Z').toLocaleString()}</div></div>)}</div>)}</div>
}
