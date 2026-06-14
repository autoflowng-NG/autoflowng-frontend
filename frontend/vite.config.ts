import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// WEAK-10: CSP meta tag injection — provides a fallback policy when the
// frontend is served from a CDN or static host without the backend's
// HTTP Content-Security-Policy header.
const cspMetaPlugin = {
  name: 'html-csp',
  transformIndexHtml(html: string): string {
    const csp = [
      "default-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com", "media-src 'self' https://hebbkx1anhila5yf.public.blob.vercel-storage.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' wss: https://api.paystack.co https://autoflowng-backend-production-dfa9.up.railway.app",
      "frame-src https://challenges.cloudflare.com https://js.paystack.co",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');
    return html.replace(
      '<head>',
      `<head>\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`
    );
  },
};

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(command === 'build' ? [cspMetaPlugin] : []),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'lucide-react'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
}));
