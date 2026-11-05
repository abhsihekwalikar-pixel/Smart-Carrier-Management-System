import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// /api/* is forwarded to the FastAPI backend (prefix stripped), so there are no CORS problems in dev
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') } } } })
