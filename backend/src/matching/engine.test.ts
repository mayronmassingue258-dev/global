import { describe, expect, it } from "vitest";
import { expandCountries, COUNTRY_GROUPS, COUNTRY_CODES } from "./countries.js";
import { gpaPercent, matchScholarship, profileCompleteness } from "./engine.js";
import { matchSchema, profileSchema, sanitizeProfile, type ScholarshipMatch, type StudentProfile } from "./model.js";

const TODAY = new Date("2026-11-17T12:00:00Z");
const profile = (p: Partial<StudentProfile> = {}) => profileSchema.parse(p);
const scholarship = (m: Partial<ScholarshipMatch> = {}, deadline = "2027-03-01") => ({ deadline, match: matchSchema.parse({ levels: ["master"], ...m }) });
const codes = (r: { reasons: { code: string }[] }) => r.reasons.map((x) => x.code);

/** Estudante moçambicano típico, perfil completo. */
const ana = profile({
  nationalities: ["MZ"], residenceCountry: "MZ", completedLevel: "bachelor", targetLevels: ["master"], fields: ["public_health"],
  gpa: { value: 15, scale: "20" }, languages: [{ code: "pt", level: "native" }, { code: "en", level: "B2" }], tests: [{ type: "ielts", score: 6.5 }],
  fundingNeed: "full", canPayApplicationFee: false, birthYear: 1999, workYears: 2, studyMode: "onsite", startYear: 2027
});

describe("países", () => {
  it("grupos têm os tamanhos oficiais e só códigos válidos", () => {
    expect(COUNTRY_GROUPS["@AFRICA"]).toHaveLength(54);
    expect(COUNTRY_GROUPS["@CPLP"]).toHaveLength(9);
    expect(COUNTRY_GROUPS["@COMMONWEALTH"]).toHaveLength(56);
    const valid = new Set<string>(COUNTRY_CODES);
    for (const list of Object.values(COUNTRY_GROUPS)) for (const c of list) expect(valid.has(c), c).toBe(true);
  });
  it("expande grupos e mantém códigos soltos", () => {
    const set = expandCountries(["@CPLP", "FR"]);
    expect(set.has("MZ") && set.has("BR") && set.has("FR")).toBe(true);
    expect(set.has("ZA")).toBe(false);
  });
});

describe("nota acadêmica", () => {
  it("converte escalas diferentes para %", () => {
    expect(gpaPercent({ value: 15, scale: "20" })).toBe(75);
    expect(gpaPercent({ value: 3.2, scale: "4" })).toBe(80);
    expect(gpaPercent(null)).toBeNull();
  });
});

describe("filtros eliminatórios", () => {
  it("nacionalidade fora da lista (inclusive por grupo) elimina", () => {
    expect(matchScholarship(ana, scholarship({ eligibleNationalities: ["@AFRICA"], coverage: ["tuition", "living"] }), TODAY).eligibility).not.toBe("not_eligible");
    const out = matchScholarship(ana, scholarship({ eligibleNationalities: ["@COMMONWEALTH"] }), TODAY);
    expect(out.eligibility).toBe("not_eligible"); // Moçambique É Commonwealth…
    expect(codes(out)).not.toContain("nationality_not_eligible"); // …então o motivo é outro (necessidade de bolsa integral)
    const br = matchScholarship(profile({ ...ana, nationalities: ["BR"] }), scholarship({ eligibleNationalities: ["@AFRICA"] }), TODAY);
    expect(br).toMatchObject({ eligibility: "not_eligible", score: 0 });
    expect(br.reasons[0]).toEqual({ kind: "failed", code: "nationality_not_eligible" });
  });

  it("dupla nacionalidade: basta uma estar na lista", () => {
    const r = matchScholarship(profile({ ...ana, nationalities: ["BR", "PT"] }), scholarship({ eligibleNationalities: ["PT"], coverage: ["tuition", "living"] }), TODAY);
    expect(codes(r)).toContain("nationality_ok");
  });

  it("nível não financiado e pré-requisito não concluído eliminam", () => {
    expect(codes(matchScholarship(ana, scholarship({ levels: ["phd"] }), TODAY))).toContain("level_not_offered");
    const phd = matchScholarship(profile({ ...ana, targetLevels: ["phd"] }), scholarship({ levels: ["phd"], requiredCompletedLevel: "master" }), TODAY);
    expect(codes(phd)).toContain("prerequisite_failed");
    // Doutorado sem exigência explícita: basta a graduação (muitos programas aceitam).
    const direct = matchScholarship(profile({ ...ana, targetLevels: ["phd"] }), scholarship({ levels: ["phd"], coverage: ["tuition", "living"] }), TODAY);
    expect(codes(direct)).toContain("prerequisite_ok");
  });

  it("quem precisa de bolsa integral não recebe bolsa sem propina E sustento", () => {
    const partial = matchScholarship(ana, scholarship({ coverage: ["tuition"] }), TODAY);
    expect(partial.eligibility).toBe("not_eligible");
    expect(partial.reasons[0]).toMatchObject({ code: "funding_insufficient", params: { uncovered: ["living", "travel", "accommodation"] } });
    const full = matchScholarship(ana, scholarship({ coverage: ["tuition", "living"] }), TODAY);
    expect(full.eligibility).not.toBe("not_eligible");
    expect(codes(full)).toContain("funding_partial"); // falta viagem e alojamento: lacuna, não eliminação
  });

  it("idade, experiência, público restrito, modalidade, destino excluído e prazo vencido eliminam", () => {
    const base = { coverage: ["tuition", "living", "travel", "accommodation"] as ScholarshipMatch["coverage"] };
    expect(codes(matchScholarship(ana, scholarship({ ...base, maxAge: 25 }), TODAY))).toContain("age_failed");
    expect(codes(matchScholarship(ana, scholarship({ ...base, minWorkYears: 3 }), TODAY))).toContain("work_failed");
    expect(codes(matchScholarship(profile({ ...ana, groups: ["refugee"] }), scholarship({ ...base, restrictedTo: ["women"] }), TODAY))).toContain("group_restricted");
    expect(codes(matchScholarship(ana, scholarship({ ...base, studyMode: "online" }), TODAY))).toContain("mode_mismatch");
    expect(codes(matchScholarship(profile({ ...ana, excludedDestinations: ["GB"] }), scholarship({ ...base, destinations: ["GB"] }), TODAY))).toContain("destination_excluded");
    expect(codes(matchScholarship(ana, scholarship(base, "2026-11-01"), TODAY))).toContain("deadline_closed");
  });
});

describe("informação em falta e lacunas", () => {
  it("perfil vazio: nada eliminado, elegibilidade em aberto, motivos de 'falta informar'", () => {
    const r = matchScholarship(profile(), scholarship({ eligibleNationalities: ["MZ"], maxAge: 30, minGpaPercent: 70, languages: [{ code: "en", minLevel: "B2" }] }), TODAY);
    expect(r.eligibility).toBe("possible");
    expect(codes(r)).toEqual(expect.arrayContaining(["nationality_missing", "level_missing", "age_missing", "gpa_missing", "language_missing", "funding_missing", "prerequisite_missing", "field_any"]));
    expect(r.score).toBeGreaterThan(0);
  });

  it("público restrito sem grupo declarado: em aberto, não eliminado (dado sensível e opcional)", () => {
    expect(matchScholarship(profile({ ...ana, groups: [] }), scholarship({ restrictedTo: ["women"], coverage: ["tuition", "living"] }), TODAY).eligibility).toBe("possible");
  });

  it("idioma e teste abaixo do pedido viram lacunas com o que falta", () => {
    const r = matchScholarship(ana, scholarship({
      coverage: ["tuition", "living", "travel", "accommodation"], languages: [{ code: "en", minLevel: "C1" }, { code: "fr", minLevel: "B1" }],
      tests: [{ type: "ielts", minScore: 7 }]
    }), TODAY);
    expect(r.eligibility).toBe("possible");
    expect(r.reasons).toEqual(expect.arrayContaining([
      { kind: "gap", code: "language_gap", params: { code: "en", min: "C1", yours: "B2" } },
      { kind: "gap", code: "language_gap", params: { code: "fr", min: "B1", yours: "none" } },
      { kind: "gap", code: "test_gap", params: { type: "ielts", min: 7, yours: 6.5 } }
    ]));
  });

  it("teste aceito: basta um da lista", () => {
    const r = matchScholarship(ana, scholarship({ coverage: ["tuition", "living"], tests: [{ type: "toefl_ibt", minScore: 90 }, { type: "ielts", minScore: 6.5 }] }), TODAY);
    expect(r.reasons).toContainEqual({ kind: "met", code: "test_ok", params: { type: "ielts", min: 6.5 } });
  });

  it("nota abaixo do mínimo é lacuna, acima é cumprida", () => {
    expect(codes(matchScholarship(ana, scholarship({ coverage: ["tuition", "living"], minGpaPercent: 80 }), TODAY))).toContain("gpa_gap");
    expect(codes(matchScholarship(ana, scholarship({ coverage: ["tuition", "living"], minGpaPercent: 70 }), TODAY))).toContain("gpa_ok");
  });

  it("prazo próximo é avisado", () => {
    expect(matchScholarship(ana, scholarship({ coverage: ["tuition", "living"] }, "2026-11-30"), TODAY).reasons).toContainEqual({ kind: "info", code: "deadline_soon", params: { days: 13 } });
  });
});

describe("nota de compatibilidade", () => {
  const ideal = scholarship({
    fields: ["public_health"], eligibleNationalities: ["@CPLP"], destinations: ["PT"], coverage: ["tuition", "living", "travel", "accommodation"],
    languages: [{ code: "pt", minLevel: "C1" }], minGpaPercent: 60
  });

  it("bolsa feita para o perfil: elegível e nota alta", () => {
    const r = matchScholarship(profile({ ...ana, destinations: ["PT"] }), ideal, TODAY);
    expect(r).toMatchObject({ eligibility: "eligible", fit: "high" });
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it("ordena: área certa > qualquer área > outra área", () => {
    const score = (fields: ScholarshipMatch["fields"]) => matchScholarship(ana, scholarship({ fields, coverage: ["tuition", "living", "travel", "accommodation"] }), TODAY).score;
    expect(score(["public_health"])).toBeGreaterThan(score([]));
    expect(score([])).toBeGreaterThan(score(["law"]));
  });

  it("cobrir mais do que o estudante precisa pesa mais; taxa que ele não pode pagar pesa menos", () => {
    const full = matchScholarship(ana, scholarship({ coverage: ["tuition", "living", "travel", "accommodation"] }), TODAY).score;
    const half = matchScholarship(ana, scholarship({ coverage: ["tuition", "living"] }), TODAY).score;
    const fee = matchScholarship(ana, scholarship({ coverage: ["tuition", "living", "travel", "accommodation"], applicationFee: true }), TODAY);
    expect(full).toBeGreaterThan(half);
    expect(fee.score).toBeLessThan(full);
    expect(codes(fee)).toContain("fee_cannot_pay");
  });

  it("nota sempre entre 0 e 100; eliminadas ficam com 0", () => {
    for (const p of [profile(), ana]) {
      for (const m of [{}, { coverage: ["tuition"] as ScholarshipMatch["coverage"] }, { levels: ["phd"] as ScholarshipMatch["levels"] }]) {
        const r = matchScholarship(p, scholarship(m), TODAY);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
        if (r.eligibility === "not_eligible") expect(r.score).toBe(0);
      }
    }
  });

  it("motivos vêm ordenados: eliminatórios, lacunas, faltas, cumpridos, avisos", () => {
    const r = matchScholarship(profile({ nationalities: ["BR"] }), scholarship({ eligibleNationalities: ["MZ"], minGpaPercent: 50, languages: [{ code: "en", minLevel: "B2" }] }), TODAY);
    const order = { failed: 0, gap: 1, missing: 2, met: 3, info: 4 };
    const kinds = r.reasons.map((x) => order[x.kind]);
    expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
  });
});

describe("perfil", () => {
  it("completude conta os itens que mais afetam as recomendações", () => {
    expect(profileCompleteness(profile())).toMatchObject({ percent: 0 });
    expect(profileCompleteness(ana)).toEqual({ percent: 100, missing: [] });
  });

  it("leitura tolerante: campo antigo/ inválido vira o padrão sem perder o resto", () => {
    const p = sanitizeProfile({ nationalities: ["MZ"], startYear: 2001, targetLevels: ["mestrado"], removed: 1 });
    expect(p).toMatchObject({ nationalities: ["MZ"], startYear: null, targetLevels: [] });
    expect(p).not.toHaveProperty("removed");
    expect(sanitizeProfile(null)).toEqual(profile());
  });
});
