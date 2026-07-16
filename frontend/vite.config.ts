import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// 开发代理：把 /api 与 /uploads 转发到本地后端，使前端与后端资源同源。
// 好处：无需 CORS、后端图片不再跨源污染 canvas（截图/html2canvas 可用）。
// 前端因此可不设 VITE_API_BASE_URL，走 window.origin 同源请求（见 api/client.ts）。
const BACKEND = process.env.VITE_DEV_BACKEND ?? 'http://127.0.0.1:8001'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/uploads': { target: BACKEND, changeOrigin: true },
    },
  },
})
