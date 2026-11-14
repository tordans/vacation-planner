import os from 'node:os'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import browserslistToEsbuild from 'browserslist-to-esbuild'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// Same policy as api/deploy/htaccess, so `bun run build && bun run preview` shows violations.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://www.mehr-schulferien.de",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

// The PHP API (api/README.md, "Local development"): `bun run dev-api` listens on port 8787.
const apiProxy = { '/api': 'http://localhost:8787' }

export default defineConfig({
  base: '/',
  plugins: [viteReact({ compiler: true }), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    target: browserslistToEsbuild(),
  },
  server: {
    proxy: apiProxy,
    fs: {
      allow: [
        searchForWorkspaceRoot(import.meta.dirname),
        path.join(os.homedir(), '.bun/install/cache/links'),
      ],
    },
  },
  preview: {
    proxy: apiProxy,
    headers: { 'Content-Security-Policy': contentSecurityPolicy },
  },
})
