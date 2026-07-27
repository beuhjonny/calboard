import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function googlePhotosProxyPlugin(): Plugin {
  return {
    name: 'google-photos-proxy',
    configureServer(server) {
      server.middlewares.use('/api/google-photos-proxy', async (req, res) => {
        try {
          const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
          const targetUrl = urlParams.get('url');

          if (!targetUrl) {
            res.statusCode = 400;
            res.end('Missing url parameter');
            return;
          }

          const googleRes = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            }
          });

          if (!googleRes.ok) {
            res.statusCode = googleRes.status;
            res.end(`Google returned status ${googleRes.status}`);
            return;
          }

          const html = await googleRes.text();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;
          res.end(html);
        } catch (err: any) {
          res.statusCode = 500;
          res.end(err.message || 'Internal proxy error');
        }
      });
    }
  };
}

const buildTimestamp = Date.now();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), googlePhotosProxyPlugin()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${buildTimestamp}.js`,
        chunkFileNames: `assets/[name]-${buildTimestamp}.js`,
        assetFileNames: `assets/[name]-${buildTimestamp}.[ext]`
      }
    }
  }
})
