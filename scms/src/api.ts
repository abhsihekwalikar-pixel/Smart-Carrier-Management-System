import { useEffect, useState } from 'react'
const TK = 'scms_tokens'
export const getTokens = (): { access: string; refresh: string } | null => { try { return JSON.parse(localStorage.getItem(TK) || 'null') } catch { return null } }
export const setTokens = (t: { access: string; refresh: string } | null) => (t ? localStorage.setItem(TK, JSON.stringify(t)) : localStorage.removeItem(TK))
const msg = (d: any): string => typeof d?.detail === 'string' ? d.detail : Array.isArray(d?.detail) ? d.detail.map((x: any) => x.msg).join('; ') : 'Something went wrong.'
async function raw(path: string, method: string, body: unknown, token?: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token
  try { return await fetch('/api' + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }) }
  catch { throw new Error('Cannot reach the server. Is the backend running on port 8000?') }
}
export async function api<T = any>(path: string, method = 'GET', body?: unknown, auth = true): Promise<T> {
  let t = getTokens(); let r = await raw(path, method, body, auth ? t?.access : undefined)
  if (r.status === 401 && auth && t?.refresh) { // access token expired -> rotate refresh token once, retry
    const rr = await raw('/auth/refresh', 'POST', { refresh_token: t.refresh })
    if (rr.ok) { const d = await rr.json(); t = { access: d.access_token, refresh: d.refresh_token }; setTokens(t); r = await raw(path, method, body, t.access) } else setTokens(null)
  }
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(msg(d))
  return d as T
}
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState('')
  const load = () => api<T>(path).then(d => { setData(d); setError('') }).catch(e => setError(e.message))
  useEffect(() => { load() }, [path])
  return { data, error, reload: load }
}
export async function download(path: string, filename: string) {
  await api('/auth/me') // makes sure the access token is fresh (rotates it if expired)
  const r = await raw(path, 'GET', undefined, getTokens()?.access)
  if (!r.ok) throw new Error(msg(await r.json().catch(() => ({}))))
  const url = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}
