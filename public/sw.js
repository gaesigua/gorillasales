/* GorillaSales service worker: lets sales officers log visits with no signal.
 *
 * - The Visits page (/daily-sales-entry) is kept as an offline copy: it carries the customer
 *   list, products and prices as they were the last time the officer was online.
 * - Built scripts and styles (/_next/static, content-hashed) are kept so that copy can run.
 * - Every other page needs the network; offline it shows a short notice instead.
 * Visits entered offline are queued by the page itself (IndexedDB), not here.
 */
const STATIC_CACHE = 'gs-static-v1';
const FIELD_CACHE = 'gs-field-v1'; // per-user data: emptied on log out
const FIELD_PAGE = '/daily-sales-entry';
const MAX_STATIC_ENTRIES = 400;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC_CACHE, FIELD_CACHE];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

async function trimStatic(cache) {
  const keys = await cache.keys();
  for (const req of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) await cache.delete(req);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    trimStatic(cache);
  }
  return res;
}

/** Saves a fresh copy of the Visits page and every script/style it needs. */
async function storeFieldPage(res) {
  const html = await res.clone().text();
  const field = await caches.open(FIELD_CACHE);
  await field.put(FIELD_PAGE, res.clone());
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s\\)<>]+/g) || []);
  const stat = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...assets].map(async (url) => {
      if (await stat.match(url)) return;
      try {
        const r = await fetch(url);
        if (r.ok) await stat.put(url, r);
      } catch {
        /* offline again: the next refresh fills the gap */
      }
    })
  );
  trimStatic(stat);
}

function isFreshFieldPage(res) {
  return res.ok && !res.redirected && new URL(res.url).pathname === FIELD_PAGE;
}

async function refreshFieldCopy() {
  try {
    const res = await fetch(FIELD_PAGE, { credentials: 'same-origin', cache: 'no-store' });
    if (isFreshFieldPage(res)) await storeFieldPage(res);
    else if (res.redirected) await caches.delete(FIELD_CACHE); // signed out: drop the copy
  } catch {
    /* offline: keep the copy we have */
  }
}

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline - GorillaSales</title>
<style>body{margin:0;font:13px Verdana,Tahoma,sans-serif;color:#000;background:#fff}
.h{background:#4a2c17;color:#fff;font-weight:bold;font-size:16px;padding:8px 16px}
.b{padding:16px;max-width:560px}a{color:#0645ad}</style></head>
<body><div class="h">GorillaSales</div><div class="b"><h1 style="font-size:18px">No connection</h1>
<p>This page needs the internet. You can still log visits and orders on the
<a href="${FIELD_PAGE}">Visits page</a>; they are kept on this phone and sent when the connection returns.</p>
<p><a href="javascript:location.reload()">Try again</a></p></div></body></html>`;

async function navigate(request) {
  const path = new URL(request.url).pathname;
  try {
    const res = await fetch(request);
    if (path === FIELD_PAGE && isFreshFieldPage(res)) storeFieldPage(res.clone());
    return res;
  } catch {
    if (path === FIELD_PAGE) {
      const copy = await caches.match(FIELD_PAGE, { cacheName: FIELD_CACHE, ignoreSearch: true, ignoreVary: true });
      if (copy) return copy;
    }
    return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
  } else if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(cacheFirst(request));
  }
  // Everything else (data requests, API calls) goes straight to the network
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'refresh-field-copy') event.waitUntil(refreshFieldCopy());
  if (type === 'clear-field-copy') event.waitUntil(caches.delete(FIELD_CACHE));
});
