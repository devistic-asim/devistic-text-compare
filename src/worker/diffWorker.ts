import { computeDiff } from '../lib/diffEngine.ts';
import type { DiffModel, DiffOptions } from '../lib/types.ts';

interface DiffRequest {
  id: number;
  original: string;
  changed: string;
  options: DiffOptions;
}

interface DiffResponse {
  id: number;
  model: DiffModel;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<DiffRequest>) => void) | null;
  postMessage(message: DiffResponse): void;
};

scope.onmessage = (event) => {
  const { id, original, changed, options } = event.data;
  try {
    scope.postMessage({ id, model: computeDiff(original, changed, options) });
  } catch {
    scope.postMessage({
      id,
      model: {
        rows: [],
        stats: { added: 0, removed: 0, changed: 0 },
        timedOut: false,
        error: 'Could not compare these texts.',
      },
    });
  }
};
