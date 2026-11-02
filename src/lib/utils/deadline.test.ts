import { describe, expect, it } from "vitest";
import { daysUntil, deadlineInfo } from "./deadline";

const now = new Date("2026-11-02T23:30:00-03:00"); // já é dia 3 em UTC

describe("daysUntil", () => {
  it("conta dias em UTC, sem depender do fuso local", () => {
    expect(daysUntil("2026-11-03", now)).toBe(0);
    expect(daysUntil("2026-11-13", now)).toBe(10);
    expect(daysUntil("2026-11-01", now)).toBe(-2);
  });

  it("data inválida → null", () => {
    expect(daysUntil("sem data", now)).toBeNull();
  });
});

describe("deadlineInfo", () => {
  it.each([
    ["2026-11-01", "closed", "Prazo encerrado"],
    ["2026-11-03", "urgent", "Termina hoje"],
    ["2026-11-04", "urgent", "Termina amanhã"],
    ["2026-11-17", "urgent", "Faltam 14 dias"],
    ["2026-11-18", "soon", "Faltam 15 dias"],
    ["2026-12-18", "soon", "Faltam 45 dias"],
    ["2026-12-19", "normal", "Faltam 46 dias"],
    ["x", "unknown", "Prazo não informado"]
  ])("%s → %s", (iso, tone, label) => {
    const info = deadlineInfo(iso, now);
    expect(info.tone).toBe(tone);
    expect(info.label).toBe(label);
  });
});
