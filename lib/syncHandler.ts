// Handler de sincronización en la nube (compartido por server.ts y api/sync.ts en Vercel).
// Permite sincronizar tareas, gastos, mensajes, planillas gerenciales, puestos y contraseñas
// entre todos los dispositivos conectados.

import fs from 'fs';
import path from 'path';

const LOCAL_STATE_FILE = path.join(
  process.env.VERCEL ? '/tmp' : process.cwd(),
  '.invict-cloud-state.json'
);

interface CloudStateStore {
  version: number;
  updatedAt: string;
  lastEvent: any | null;
  state: Record<string, any>;
}

let memoryStore: CloudStateStore | null = null;

function loadStore(): CloudStateStore {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(LOCAL_STATE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STATE_FILE, 'utf-8');
      memoryStore = JSON.parse(raw);
      return memoryStore!;
    }
  } catch {
    // ignore read errors
  }
  memoryStore = {
    version: 0,
    updatedAt: new Date().toISOString(),
    lastEvent: null,
    state: {},
  };
  return memoryStore;
}

function saveStore(store: CloudStateStore): void {
  memoryStore = store;
  try {
    fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(store), 'utf-8');
  } catch {
    // ignore write errors in read-only environments
  }
}

export async function cloudSyncHandler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const store = loadStore();

  if (req.method === 'GET') {
    const sinceVersion = Number(req.query?.since || 0);
    if (sinceVersion > 0 && sinceVersion === store.version) {
      return res.status(200).json({
        changed: false,
        version: store.version,
        updatedAt: store.updatedAt,
      });
    }
    return res.status(200).json({
      changed: true,
      version: store.version,
      updatedAt: store.updatedAt,
      lastEvent: store.lastEvent,
      state: store.state,
    });
  }

  if (req.method === 'POST') {
    const { event, partialState } = req.body || {};
    if (partialState && typeof partialState === 'object') {
      store.state = {
        ...store.state,
        ...partialState,
      };
    }
    if (event) {
      store.lastEvent = event;
    }
    store.version += 1;
    store.updatedAt = new Date().toISOString();
    saveStore(store);

    return res.status(200).json({
      ok: true,
      version: store.version,
      updatedAt: store.updatedAt,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
