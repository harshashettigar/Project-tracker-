// React hook over the stale-while-revalidate cache (see cache.js).
//
// On mount (and whenever `key` changes) it renders the cached value IMMEDIATELY
// if present, then kicks off a background revalidation. A revisit therefore shows
// content with no blank/loading flash; only a truly cold key (never fetched) hits
// the `loading` state. `reload()` forces a fresh fetch — call it after a mutation.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCached, fetchCached } from './cache.js';

export function useCachedQuery(key, fetcher) {
  // Keep the latest fetcher without making it a dependency — each render passes a
  // new closure (() => api.getX(id)), and depending on its identity would loop.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState(() => getCached(key) ?? null);
  const [error, setError] = useState('');
  const [revalidating, setRevalidating] = useState(false);

  const revalidate = useCallback(
    async (force = false) => {
      setRevalidating(true);
      setError('');
      try {
        const fresh = await fetchCached(key, () => fetcherRef.current(), { force });
        setData(fresh);
        return fresh;
      } catch (e) {
        setError(e.message || 'Could not load.');
        throw e;
      } finally {
        setRevalidating(false);
      }
    },
    [key],
  );

  useEffect(() => {
    // Show whatever we have for this key right now (stale is fine), then refresh.
    setData(getCached(key) ?? null);
    setError('');
    revalidate(false).catch(() => {});
  }, [key, revalidate]);

  return {
    data,
    // Cold load only: no cached data yet and no error to show instead.
    loading: data === null && !error,
    error,
    revalidating,
    reload: () => revalidate(true),
  };
}
