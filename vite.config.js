import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function legacyChunkAliases() {
  return {
    name: 'tmhub-legacy-chunk-aliases',
    generateBundle(_options, bundle) {
      const jspdfChunk = Object.values(bundle).find(
        (item) => item.type === 'chunk' && /^assets\/jspdf\.es\.min-.*\.js$/.test(item.fileName),
      )
      if (!jspdfChunk) return

      const currentFile = jspdfChunk.fileName.split('/').at(-1)
      this.emitFile({
        type: 'asset',
        fileName: 'assets/jspdf.es.min-B44-1cNh.js',
        source: `export { default } from "./${currentFile}";\nexport * from "./${currentFile}";\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), legacyChunkAliases()],
  build: {
    // Abas abertas ainda podem solicitar chunks da versão anterior depois de
    // um deploy. A limpeza controlada acontece no workflow após 14 dias.
    emptyOutDir: false,
  },
  server: {
    allowedHosts: ['.trycloudflare.com'],
  },
})
