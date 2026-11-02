import type { Application, ApplicationUpdate, TimelineEvent } from "@/types";

/** Edições seguidas nas notas em até 10 minutos viram um único evento na linha do tempo. */
export const NOTES_MERGE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Aplica uma atualização parcial e registra eventos na linha do tempo.
 * Mesma regra do servidor local (mock-api/server.mjs); usada no modo demonstração e na atualização otimista.
 */
export function applyApplicationUpdate(app: Application, update: ApplicationUpdate, now: Date = new Date()): Application {
  const at = now.toISOString();
  const timeline: TimelineEvent[] = [...app.timeline];
  let { status, notes, documents } = app;
  let changed = false;

  if (update.status !== undefined && update.status !== status) {
    status = update.status;
    timeline.push({ at, kind: "status", status });
    changed = true;
  }

  if (update.documents) {
    const wanted = new Map(update.documents.map((d) => [d.name, d.done]));
    documents = documents.map((doc) => {
      const done = wanted.get(doc.name);
      if (done === undefined || done === doc.done) return doc;
      timeline.push({ at, kind: "document", document: doc.name, done });
      changed = true;
      return { ...doc, done };
    });
  }

  if (update.notes !== undefined && update.notes !== notes) {
    notes = update.notes;
    const last = timeline.at(-1);
    if (last?.kind === "notes" && now.getTime() - Date.parse(last.at) < NOTES_MERGE_WINDOW_MS) timeline[timeline.length - 1] = { at, kind: "notes" };
    else timeline.push({ at, kind: "notes" });
    changed = true;
  }

  return changed ? { ...app, status, notes, documents, timeline, updatedAt: at } : app;
}

export function documentProgress(app: Pick<Application, "documents">): { done: number; total: number } {
  return { done: app.documents.filter((d) => d.done).length, total: app.documents.length };
}
