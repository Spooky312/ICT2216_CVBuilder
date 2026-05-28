import { useState, useCallback } from 'react';

/**
 * useAsyncAction — run an async action while tracking a boolean loading key.
 *
 * Returns a `run(key, fn)` helper that:
 *  - sets `loading[key] = true` before calling fn
 *  - sets `loading[key] = false` in finally (always)
 *  - re-throws so the caller can handle success / error normally
 *
 * Usage:
 *   const { loading, run } = useAsyncAction();
 *   const handleSave = async () => {
 *     try {
 *       await run('save', () => api.updateProfile(data));
 *       setMsg('Saved!');
 *     } catch (err) {
 *       setMsg(err.response?.data?.message || 'Save failed.');
 *     }
 *   };
 *   <button disabled={loading.save}>Save</button>
 */
export function useAsyncAction() {
  const [loading, setLoading] = useState({});

  const run = useCallback(async (key, fn) => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      return await fn();
    } finally {
      setLoading((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, []);

  return { loading, run };
}
