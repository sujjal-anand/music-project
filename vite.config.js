import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '172.24.0.208', // Expose to all network devices
    port: 5173,      // Default Vite port
    strictPort: true, // Prevent port fallback
    https: {
      key: fs.readFileSync('./cert/key.pem'),
      cert: fs.readFileSync('./cert/cert.pem'),
    },
    cors: true // Allow cross-origin access
  }
});
