import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom', // This is the fake web browser
    globals: true,
    setupFiles: './src/setupTests.js', // We will create this next
  }
})