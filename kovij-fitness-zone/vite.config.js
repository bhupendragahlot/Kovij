import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy:{
      '/api':{
        target:'https://kovij.onrender.com/',
        secure:false,
      }
    },
  allowedHosts: ['kovij.onrender.com']
},
  plugins: [react(),
    tailwindcss(),
  ],
})
