// Handler de sincronización en la nube respaldado permanentemente por PostgreSQL (Supabase).
// Funciona tanto en Vercel (api/sync.ts) como en el servidor local (server.ts).

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://dnfgffluifwaucppqwwn.supabase.co';

const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZmdmZmx1aWZ3YXVjcHBxd3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MjgzNTUsImV4cCI6MjEwOTIwNDM1NX0.glu7IVyK347V-OajXvl9KsWwhJmnkQ6Fsd7_BZpxLsE';

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

export async function cloudSyncHandler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  try {
    if (req.method === 'GET') {
      const sinceVersion = Number(req.query?.since || 0);

      // Ultra-lightweight HEAD check if client sent sinceVersion
      if (sinceVersion > 0) {
        const checkRes = await fetch(
          `${SUPABASE_URL}/rest/v1/invict_cloud_state?id=eq.global_state&select=version,updated_at,client_id`,
          { headers: HEADERS }
        );
        if (checkRes.ok) {
          const checkRows = (await checkRes.json()) as any[];
          const checkRow = checkRows?.[0];
          const dbVer = Number(checkRow?.version || 0);
          if (dbVer > 0 && dbVer <= sinceVersion) {
            return res.status(200).json({
              changed: false,
              version: dbVer,
              updatedAt: checkRow?.updated_at,
            });
          }
        }
      }

      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/invict_cloud_state?id=eq.global_state&select=version,updated_at,client_id,last_event,state`,
        { headers: HEADERS }
      );
      if (!r.ok) {
        return res.status(502).json({ error: 'Database fetch failed', status: r.status });
      }
      const rows = (await r.json()) as any[];
      const row = rows?.[0];
      if (!row) {
        return res.status(200).json({ changed: false, version: 0 });
      }
      const dbVersion = Number(row.version || 0);
      if (sinceVersion > 0 && sinceVersion === dbVersion) {
        return res.status(200).json({
          changed: false,
          version: dbVersion,
          updatedAt: row.updated_at,
        });
      }
      return res.status(200).json({
        changed: true,
        version: dbVersion,
        updatedAt: row.updated_at,
        clientId: row.client_id,
        lastEvent: row.last_event,
        state: row.state || {},
      });
    }

    if (req.method === 'POST') {
      const { clientId, event, partialState } = req.body || {};
      const cleanEvent = event
        ? {
            id: event.id,
            type: event.type,
            timestamp: event.timestamp,
            authorName: event.authorName,
            authorProfile: event.authorProfile,
            authorEmail: event.authorEmail,
            summary: event.summary,
          }
        : null;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_invict_cloud_state`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          p_client_id: clientId || null,
          p_last_event: cleanEvent,
          p_partial_state: partialState || {},
        }),
      });
      if (!r.ok) {
        const errText = await r.text();
        return res.status(502).json({ error: 'Database upsert failed', details: errText });
      }
      const rows = (await r.json()) as any[];
      const updated = rows?.[0] || {};
      return res.status(200).json({
        ok: true,
        version: Number(updated.version || 1),
        updatedAt: updated.updated_at || new Date().toISOString(),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal sync error' });
  }
}
