import { describe, expect, it } from "vitest";
import { makeApplication } from "@/test/fakes";
import { applyApplicationUpdate, documentProgress } from "./applyUpdate";

const t0 = new Date("2026-11-01T10:00:00Z");
const later = (min: number) => new Date(t0.getTime() + min * 60_000);

describe("applyApplicationUpdate", () => {
  it("registra status, documento e notas na linha do tempo", () => {
    const next = applyApplicationUpdate(makeApplication(), { status: "Preparing", documents: [{ name: "Diploma", done: true }], notes: "x" }, t0);
    expect(next.timeline.map((e) => e.kind)).toEqual(["created", "status", "document", "notes"]);
    expect(next.updatedAt).toBe(t0.toISOString());
    expect(documentProgress(next)).toEqual({ done: 2, total: 2 });
  });

  it("nada muda → devolve o mesmo objeto", () => {
    const app = makeApplication();
    expect(applyApplicationUpdate(app, { status: "Saved", documents: [{ name: "Histórico", done: true }, { name: "Outro", done: true }], notes: "" }, t0)).toBe(app);
  });

  it("agrupa edições de notas em 10 minutos", () => {
    let app = applyApplicationUpdate(makeApplication(), { notes: "a" }, t0);
    app = applyApplicationUpdate(app, { notes: "ab" }, later(5));
    expect(app.timeline.filter((e) => e.kind === "notes")).toEqual([{ at: later(5).toISOString(), kind: "notes" }]);
    app = applyApplicationUpdate(app, { notes: "abc" }, later(16));
    expect(app.timeline.filter((e) => e.kind === "notes")).toHaveLength(2);
  });
});
