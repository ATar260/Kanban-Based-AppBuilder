import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // E2B/Modal/Vercel preview domains are ephemeral; disable host check for reliability.
    allowedHosts: true,
    hmr: {
      clientPort: 443,
      protocol: 'wss'
    }
  }
})

