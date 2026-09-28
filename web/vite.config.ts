import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' permite publicar a pasta dist/ em qualquer subcaminho (GitHub Pages, Vercel, etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
  // um único arquivo JS: simplifica publicar a pasta dist/ em qualquer lugar
  esbuild: { charset: 'ascii' },
  build: { rollupOptions: { output: { inlineDynamicImports: true } } },
  server: {
    // Quando existir a API FastAPI (fase 2), o Vite repassa /api para ela durante o desenvolvimento.
    proxy: { '/api': 'http://localhost:8000' },
  },
})
