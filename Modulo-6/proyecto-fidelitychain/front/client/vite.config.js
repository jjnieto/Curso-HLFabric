import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El frontend (puerto 5173) habla con la API (puerto 3000) a través de este
// proxy: cualquier petición a /api se reenvía al backend, así evitamos CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
