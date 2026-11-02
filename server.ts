import express from 'express';
import { bonoChatHandler, analyzeReceiptHandler } from './lib/aiHandlers.js';
import { cloudSyncHandler } from './lib/syncHandler.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

app.post('/api/bono/chat', bonoChatHandler);
app.post('/api/expenses/analyze-receipt', analyzeReceiptHandler);
app.all('/api/sync', cloudSyncHandler);

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`INVICT Security Solutions server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
