import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Optimize bundle splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for React and core libraries
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Firebase chunk (largest dependency)
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          // UI libraries chunk
          ui: ['@heroicons/react', 'react-hot-toast'],
          // PDF/Chart libraries chunk
          pdf: ['@react-pdf/renderer', 'html2canvas', 'jspdf', 'jspdf-autotable', 'react-to-print'],
          // Chart libraries
          charts: ['recharts'],
          // Utils chunk
          utils: ['qrcode', 'qrcode.react', 'xlsx']
        }
      }
    },
    // Increase chunk size warning limit since we're dealing with Firebase
    chunkSizeWarningLimit: 1000,
    // Enable minification and compression
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console.* calls in production
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore']
  }
}) 