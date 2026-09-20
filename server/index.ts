import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadState, saveState } from './storage.js';

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hora: new Date().toISOString() });
});

app.get('/api/state', (_req, res) => {
  res.json(loadState());
});

app.put('/api/state', (req, res) => {
  const body = req.body;
  if (typeof body !== 'object' || body === null || typeof body.days !== 'object' || Array.isArray(body.days)) {
    return res.status(400).json({ error: 'Formato inválido: se espera { days: {...} }' });
  }
  const state = { days: body.days, updatedAt: Date.now() };
  saveState(state);
  res.json(state);
});

const dist = join(process.cwd(), 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(dist, 'index.html'));
  });
}

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`be-better server escuchando en :${port}`);
});