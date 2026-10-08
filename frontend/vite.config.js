import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Flask serves the built SPA under /app (see backend/app.py serve_spa).
  base: '/app/',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/sw.js': { target: 'http://localhost:5000' },
      '/manifest.json': { target: 'http://localhost:5000' },
      '/static': { target: 'http://localhost:5000' },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js'],
  },
})
