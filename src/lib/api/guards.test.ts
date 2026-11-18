import { describe, expect, it } from "vitest";
import { makeApplication, makeScholarship } from "@/test/fakes";
import { completenessOf, emptyProfile } from "@/lib/validation/profile";
import { isAdminPage, isApplication, isApplicationList, isEligibilityResult, isProfile, isRecommendations, isScholarship, isScholarshipPage } from "./guards";

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

  it("isScholarship confere os critérios quando vêm", () => {
    const match = { levels: ["master"], fields: [], eligibleNationalities: ["@AFRICA"], destinations: ["PT"], coverage: [], languages: [], tests: [], minGpaPercent: null, requiredCompletedLevel: null, maxAge: null, minWorkYears: null, restrictedTo: [], applicationFee: false, studyMode: "onsite" };
    expect(isScholarship(makeScholarship({ match: match as never, status: "active" }))).toBe(true);
    expect(isScholarship({ ...makeScholarship(), match: { ...match, levels: "master" } })).toBe(false);
    expect(isScholarship({ ...makeScholarship(), status: "deleted" })).toBe(false);
  });

  it("isEligibilityResult checa status, nota e motivos em código", () => {
    const ok = { scholarshipId: "a", status: "eligible", score: 80, fit: "high", reasons: [{ kind: "met", code: "nationality_ok" }, { kind: "gap", code: "gpa_gap", params: { min: 70, yours: 60 } }] };
    expect(isEligibilityResult(ok)).toBe(true);
    expect(isEligibilityResult({ ...ok, status: "maybe" })).toBe(false);
    expect(isEligibilityResult({ ...ok, score: "80" })).toBe(false);
    expect(isEligibilityResult({ ...ok, reasons: [{ kind: "other", code: "x" }] })).toBe(false);
    expect(isEligibilityResult({ ...ok, reasons: [{ kind: "met", text: "formato antigo" }] })).toBe(false);
  });

  it("isRecommendations e isAdminPage", () => {
    const item = { scholarship: makeScholarship(), eligibility: "possible", score: 50, fit: "low", reasons: [], saved: false };
    expect(isRecommendations({ considered: 3, excluded: 1, items: [item] })).toBe(true);
    expect(isRecommendations({ considered: 3, excluded: 1, items: [{ ...item, eligibility: "not_eligible" }] })).toBe(false);
    expect(isAdminPage({ total: 1, items: [{ ...makeScholarship(), openReports: 0 }] })).toBe(true);
    expect(isAdminPage({ total: 1, items: [makeScholarship()] })).toBe(false);
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

  it("isProfile exige o perfil estruturado com completude", () => {
    const profile = { ...emptyProfile, completeness: completenessOf(emptyProfile) };
    expect(isProfile(profile)).toBe(true);
    expect(isProfile({ ...profile, updatedAt: "2026-01-01T00:00:00Z" })).toBe(true);
    expect(isProfile(emptyProfile)).toBe(false);
    expect(isProfile({ ...profile, nationalities: "MZ" })).toBe(false);
    expect(isProfile({ ...profile, gpa: { value: "14", scale: "20" } })).toBe(false);
    expect(isProfile({ residence: "Moçambique", level: "Mestrado" })).toBe(false);
  });
});
