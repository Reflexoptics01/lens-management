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
        // Keep console.log but remove console.debug in production for debugging
        drop_console: false,
        drop_debugger: true,
        // Only drop specific console methods
        pure_funcs: ['console.debug']
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore']
  }
}) 