// Tiny in-memory stale-while-revalidate cache for read-only GETs.
//
// Why: every page switch used to blank the screen and wait on a fresh
// client→Railway→Supabase round-trip (2–3s, worse on a cold backend). This keeps
// the last successful payload per key so a revisit renders INSTANTLY from cache
// while a background fetch refreshes it. It also de-dupes concurrent fetches for
// the same key, so a hover-prefetch and the subsequent mount share one request.
//
// This is a perceived-performance layer only — the server/RLS is still the
// security boundary, and the data is always revalidated against it on mount.
// The cache lives for the page session (module scope); a full reload clears it.

const store = new Map(); // key -> last successful data
const inflight = new Map(); // key -> Promise (de-dupes concurrent fetches)

export function getCached(key) {
  return store.has(key) ? store.get(key) : undefined;
}

export function setCached(key, value) {
  store.set(key, value);
}

export function invalidate(key) {
  store.delete(key);
}

// Clear everything — call on sign-out so the next user never sees cached data.
export function clearCache() {
  store.clear();
  inflight.clear();
}

// Fetch through the cache. Concurrent callers for the same key share one promise
// (unless `force`, which always issues a fresh request — used after a mutation).
// On success the result is stored; on failure the in-flight entry is cleared so a
// retry can happen.
export function fetchCached(key, fetcher, { force = false } = {}) {
  if (!force && inflight.has(key)) return inflight.get(key);
  const p = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      store.set(key, data);
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, p);
  return p;
}

// Warm the cache ahead of navigation (e.g. on row hover). No-op if we already
// have the data or a fetch is in flight. Errors are swallowed — it's best-effort.
export function prefetch(key, fetcher) {
  if (store.has(key) || inflight.has(key)) return;
  fetchCached(key, fetcher).catch(() => {});
}
