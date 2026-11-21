import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    // Listen on the LAN so a phone can open the dev server.
    host: true,
    port: 5183,
    strictPort: true,
    // HTTPS access through `tailscale serve` (WebGPU needs a secure context).
    allowedHosts: ['.ts.net'],
  },
})
