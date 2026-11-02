/**
 * Actualización automática: detecta cuando se publica una nueva versión en Vercel
 * y recarga la app sola, sin que el usuario tenga que hacer nada.
 *
 * - Revisa cada 60 s (y al volver a la pestaña) si cambió el bundle publicado.
 * - Recarga de inmediato si la pestaña está en segundo plano; si está en uso,
 *   espera a que el usuario no esté escribiendo para no perder lo que tipea.
 * - Los datos de la app viven en localStorage, por lo que la recarga no los borra.
 */

const CHECK_INTERVAL_MS = 60_000;

function getScriptSignature(html: string): string {
  const matches = html.match(/\/assets\/[^"']+\.js/g);
  return matches ? matches.sort().join('|') : '';
}

function isUserTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

let reloading = false;
function safeReload() {
  if (reloading) return;
  const tryReload = () => {
    if (document.hidden || !isUserTyping()) {
      reloading = true;
      window.location.reload();
    } else {
      setTimeout(tryReload, 5_000);
    }
  };
  tryReload();
}

export function startAutoUpdate(): void {
  if (!import.meta.env.PROD) return;

  const currentSignature = getScriptSignature(document.documentElement.outerHTML);

  const check = async () => {
    try {
      const res = await fetch(`/index.html?__version_check=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const latest = getScriptSignature(await res.text());
      if (latest && currentSignature && latest !== currentSignature) safeReload();
    } catch {
      /* sin conexión: se reintenta en el próximo ciclo */
    }
    // Pedir también al service worker que busque su nueva versión
    navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => {});
  };

  setInterval(check, CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
  window.addEventListener('focus', check);

  // Cuando un service worker nuevo toma el control, recargar para usar la versión nueva
  if ('serviceWorker' in navigator) {
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) safeReload();
      hadController = true;
    });
  }
}
