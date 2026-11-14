/**
 * `boq.line_edited` inside the tab (F06 §14): the realtime provider hands each one to the open sheets,
 * which tell their person when someone else changed a line they had edited.
 */
export interface LineEdited {
  boqId: string;
  lineKeys: string[];
  by: { id: string; name: string };
  at: string;
}

const listeners = new Set<(e: LineEdited) => void>();

export function onLineEdited(fn: (e: LineEdited) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function publishLineEdited(e: LineEdited) {
  for (const fn of listeners) fn(e);
}
