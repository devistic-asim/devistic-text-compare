import { useEffect, useState } from 'react';
import { computeDiff } from '../lib/diffEngine.ts';
import { emptyModel, type DiffModel, type DiffOptions } from '../lib/types.ts';

const WORKER_THRESHOLD = 12_000;

export function useDiff(
  original: string,
  changed: string,
  options: DiffOptions,
): { model: DiffModel; computing: boolean } {
  const [model, setModel] = useState<DiffModel>(() => emptyModel());
  const [computing, setComputing] = useState(false);

  const { ignoreWhitespace, ignoreCase, ignoreBlankLines, granularity } = options;

  useEffect(() => {
    const nextOptions: DiffOptions = { ignoreWhitespace, ignoreCase, ignoreBlankLines, granularity };
    const total = original.length + changed.length;
    let cancelled = false;
    let worker: Worker | null = null;
    const timer = window.setTimeout(() => {
      if (total <= WORKER_THRESHOLD) {
        try {
          if (!cancelled) {
            setModel(computeDiff(original, changed, nextOptions));
            setComputing(false);
          }
        } catch {
          if (!cancelled) {
            setModel({ ...emptyModel(), error: 'Could not compare these texts.' });
            setComputing(false);
          }
        }
        return;
      }

      setComputing(true);
      try {
        worker = new Worker(new URL('../worker/diffWorker.ts', import.meta.url), { type: 'module' });
      } catch {
        if (!cancelled) {
          setModel(computeDiff(original, changed, nextOptions));
          setComputing(false);
        }
        return;
      }

      const requestId = 1;
      worker.onmessage = (event: MessageEvent<{ id: number; model: DiffModel }>) => {
        if (cancelled || event.data.id !== requestId) return;
        setModel(event.data.model);
        setComputing(false);
      };
      worker.onerror = () => {
        if (cancelled) return;
        try {
          setModel(computeDiff(original, changed, nextOptions));
        } catch {
          setModel({ ...emptyModel(), error: 'Could not compare these texts.' });
        }
        setComputing(false);
      };
      worker.postMessage({ id: requestId, original, changed, options: nextOptions });
    }, total > WORKER_THRESHOLD ? 180 : 50);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [original, changed, ignoreWhitespace, ignoreCase, ignoreBlankLines, granularity]);

  return { model, computing };
}
