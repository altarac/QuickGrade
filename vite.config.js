import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  cacheDir: ".vite-cache",
  plugins: [
    tailwindcss(),
    react()
  ],
  build: { rollupOptions: { input: "app-entry.html" } },
  server: {
    port: 5173,
    host: true
  }
})
