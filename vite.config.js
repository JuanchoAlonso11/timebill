import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: 'renderer',
  base: command === 'build' ? './' : '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup:         resolve(__dirname, 'renderer/popup.html'),
        tray:          resolve(__dirname, 'renderer/tray.html'),
        idle:          resolve(__dirname, 'renderer/idle.html'),
        manual:        resolve(__dirname, 'renderer/manual.html'),
        config:        resolve(__dirname, 'renderer/config.html'),
        dashboard:     resolve(__dirname, 'renderer/dashboard.html'),
        report:        resolve(__dirname, 'renderer/report.html'),
        login:         resolve(__dirname, 'renderer/login.html'),
        'main-window': resolve(__dirname, 'renderer/main-window.html'),
      },
    },
  },
  server: {
    port: 5173,
    fs: { strict: false },
  },
}))
