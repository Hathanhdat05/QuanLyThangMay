import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Cho phép truy cập qua Cloudflare Tunnel (trycloudflare.com)
    // Nếu muốn chặt chẽ hơn, bạn có thể đổi sang hostname cụ thể
    // mà Cloudflare cấp, ví dụ: 'russia-slots-girls-boston.trycloudflare.com'
    allowedHosts: ['.trycloudflare.com'],
  },
})
