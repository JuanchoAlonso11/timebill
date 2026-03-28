import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],

  // El root del renderer
  root: 'renderer',

  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'renderer/popup.html'),
        tray:  resolve(__dirname, 'renderer/tray.html'),
      },
    },
  },

  server: {
    port: 5173,
  },
})
