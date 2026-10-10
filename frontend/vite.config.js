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
    // 'node' stays the default so the pure lib tests keep running without a
    // DOM. Component tests opt in with an @vitest-environment jsdom docblock.
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js', 'src/**/__tests__/**/*.test.jsx'],
  },
})
