import { describe, expect, it } from "vitest";
import { makeApplication, makeScholarship } from "@/test/fakes";
import { emptyProfile } from "@/lib/validation/profile";
import { isApplication, isApplicationList, isEligibilityResult, isProfile, isScholarship, isScholarshipPage } from "./guards";

describe("guards", () => {
  it("isScholarship aceita o formato do contrato e rejeita campos faltando", () => {
    expect(isScholarship(makeScholarship())).toBe(true);
    const { title: _t, ...noTitle } = makeScholarship();
    expect(isScholarship(noTitle)).toBe(false);
    expect(isScholarship({ ...makeScholarship(), verification: { status: "talvez" } })).toBe(false);
    expect(isScholarship(null)).toBe(false);
  });

  it("isScholarshipPage valida todos os itens", () => {
    expect(isScholarshipPage({ items: [makeScholarship()], total: 1 })).toBe(true);
    expect(isScholarshipPage({ items: [{}], total: 1 })).toBe(false);
    expect(isScholarshipPage({ items: [] })).toBe(false);
  });

  it("isEligibilityResult checa status e motivos", () => {
    expect(isEligibilityResult({ scholarshipId: "a", status: "eligible", reasons: [{ kind: "met", text: "ok" }] })).toBe(true);
    expect(isEligibilityResult({ scholarshipId: "a", status: "maybe", reasons: [] })).toBe(false);
    expect(isEligibilityResult({ scholarshipId: "a", status: "possible", reasons: [{ kind: "other", text: "x" }] })).toBe(false);
  });

  it("isApplication só aceita status conhecidos", () => {
    expect(isApplication(makeApplication())).toBe(true);
    expect(isApplication(makeApplication({ status: "Won" as never }))).toBe(false);
    expect(isApplicationList({ items: [makeApplication()] })).toBe(true);
    expect(isApplicationList([makeApplication()])).toBe(false);
    expect(isApplication({ ...makeApplication(), timeline: [{ at: "x", kind: "status", status: "Won" }] })).toBe(false);
    expect(isApplication({ ...makeApplication(), timeline: [{ at: "x", kind: "document", document: "D", done: "sim" }] })).toBe(false);
    expect(isApplication({ ...makeApplication(), timeline: [{ at: "x", kind: "outro" }] })).toBe(false);
    const { notes: _n, ...noNotes } = makeApplication();
    expect(isApplication(noNotes)).toBe(false);
  });

  it("isProfile exige todos os campos como texto", () => {
    expect(isProfile(emptyProfile)).toBe(true);
    expect(isProfile({ ...emptyProfile, updatedAt: "2026-01-01T00:00:00Z" })).toBe(true);
    expect(isProfile({ ...emptyProfile, level: 3 })).toBe(false);
  });
});
