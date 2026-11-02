// @vitest-environment node
import { describe, expect, it } from "vitest";
import { evaluateEligibility } from "./eligibility.mjs";

const profile = (p = {}) => ({ residence: "", nationality: "", level: "", field: "", grade: "", languages: "", interests: "", ...p });

describe("evaluateEligibility", () => {
  it("perfil vazio → possível, com o que falta", () => {
    const r = evaluateEligibility({ id: "a" }, { acceptedLevels: ["Mestrado"] }, profile());
    expect(r.status).toBe("possible");
    expect(r.reasons.every((x) => x.kind === "missing")).toBe(true);
  });

  it("nível incompatível → não elegível", () => {
    expect(evaluateEligibility({ id: "a" }, { acceptedLevels: ["Mestrado"] }, profile({ residence: "X", level: "Graduação" })).status).toBe("not_eligible");
  });

  it("tudo atendido → elegível", () => {
    const r = evaluateEligibility({ id: "a" }, { acceptedLevels: ["Mestrado"], needs: ["languages"] }, profile({ residence: "X", level: "Mestrado", languages: "Inglês C1" }));
    expect(r.status).toBe("eligible");
  });

  it("sem critérios → elegível com motivo explícito", () => {
    const r = evaluateEligibility({ id: "a" }, undefined, profile({ residence: "X", level: "Mestrado" }));
    expect(r).toEqual({ scholarshipId: "a", status: "eligible", reasons: [{ kind: "met", text: "Nenhuma restrição conhecida para o seu perfil." }] });
  });

  it("compara países sem acento e sem diferenciar maiúsculas", () => {
    const r = evaluateEligibility({ id: "a", eligibleCountries: ["Suíça"] }, {}, profile({ residence: " SUICA ", level: "Mestrado" }));
    expect(r.status).toBe("eligible");
  });
});
