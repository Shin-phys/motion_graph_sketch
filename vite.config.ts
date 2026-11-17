import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages: https://shin-phys.github.io/motion_graph_sketch/
export default defineConfig({
  base: '/motion_graph_sketch/',
  plugins: [react(), tailwindcss()],
})
