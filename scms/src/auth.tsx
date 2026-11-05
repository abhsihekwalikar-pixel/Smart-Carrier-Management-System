import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api, getTokens, setTokens } from './api'
export type RoleName = 'super_admin' | 'organization' | 'student'
export interface User { id: string; email: string; name: string; role: RoleName; organization?: { id: string; name: string; status: string } }
interface Reg { name: string; email: string; password: string; role: 'student' | 'organization'; orgName?: string; orgWebsite?: string; orgIndustry?: string; orgAddress?: string; contactPhone?: string; college?: string; course?: string }
interface Ctx { user: User | null; ready: boolean; login: (e: string, p: string) => Promise<void>; logout: () => void; register: (d: Reg) => Promise<string>; reload: () => Promise<void> }
const C = createContext<Ctx>(null!)
export const useAuth = () => useContext(C)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [ready, setReady] = useState(false)
  const reload = async () => { if (!getTokens()) return setUser(null); try { setUser(await api<User>('/auth/me')) } catch { setTokens(null); setUser(null) } }
  useEffect(() => { reload().finally(() => setReady(true)) }, [])
  const login = async (email: string, password: string) => {
    const d = await api('/auth/login', 'POST', { email, password }, false)
    setTokens({ access: d.access_token, refresh: d.refresh_token }); setUser(d.user)
  }
  const logout = () => { api('/auth/logout', 'POST').catch(() => {}); setTokens(null); setUser(null) }
  const register = async (d: Reg) => (await api('/auth/register', 'POST', { name: d.name, email: d.email, password: d.password, role: d.role, org_name: d.orgName || '', org_website: d.orgWebsite || '', org_industry: d.orgIndustry || '', org_address: d.orgAddress || '', contact_phone: d.contactPhone || '', college: d.college || '', course: d.course || '' }, false)).message as string
  return <C.Provider value={{ user, ready, login, logout, register, reload }}>{children}</C.Provider>
}
