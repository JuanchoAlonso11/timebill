import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'renderer',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup:     resolve(__dirname, 'renderer/popup.html'),
        tray:      resolve(__dirname, 'renderer/tray.html'),
        idle:      resolve(__dirname, 'renderer/idle.html'),
        manual:    resolve(__dirname, 'renderer/manual.html'),
        config:    resolve(__dirname, 'renderer/config.html'),
        dashboard: resolve(__dirname, 'renderer/dashboard.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
})
