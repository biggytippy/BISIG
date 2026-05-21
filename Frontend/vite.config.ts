import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/vm-api': {
        target: 'http://134.185.92.120:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vm-api/, ''),
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/videos': {
        target: 'http://161.118.197.176:8080',
        changeOrigin: true,
      },
      '/skeleton_videos': {
        target: 'http://134.185.92.120:8000',
        changeOrigin: true,
      },
      '/ws-match': {
        target: 'ws://localhost:8005',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/ws-match/, '/ws/match')
      }
    }
  }
})
