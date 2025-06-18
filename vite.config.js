import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Development server configuration
  server: {
    port: 5174,
    strictPort: true,
    hmr: {
      port: 5174,
      host: 'localhost'
    },
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    }
  },
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
        },
        // Remove comments in production
        generatedCode: {
          constBindings: true
        }
      }
    },
    // Increase chunk size warning limit since we're dealing with Firebase
    chunkSizeWarningLimit: 1000,
    // Enable minification and compression for production
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove all console statements in production builds
        drop_console: true,
        drop_debugger: true,
        // Remove specific debug functions
        pure_funcs: ['console.log', 'console.debug', 'console.info', 'console.warn'],
        // Remove dead code
        dead_code: true,
        // Remove unused variables
        unused: true
      },
      mangle: {
        // Mangle variable names for additional security
        safari10: true
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore']
  }
}) 