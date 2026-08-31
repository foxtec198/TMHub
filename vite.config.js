import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Abas abertas ainda podem solicitar chunks da versão anterior depois de
    // um deploy. A limpeza controlada acontece no workflow após 14 dias.
    emptyOutDir: false,
  },
  server: {
    allowedHosts: ['.trycloudflare.com'],
  },
})
