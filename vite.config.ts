import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/gw-clone/dist/',
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
  },
})
