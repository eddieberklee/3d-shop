import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    // three's addons import 'three'. Point it at the WebGPU build so the app
    // holds one copy of the library.
    alias: [{ find: /^three$/, replacement: 'three/webgpu' }],
  },
  server: {
    // Listen on the LAN so a phone can open the dev server.
    host: true,
    port: 5183,
    strictPort: true,
    // HTTPS access through `tailscale serve` (WebGPU needs a secure context).
    allowedHosts: ['.ts.net'],
  },
})
