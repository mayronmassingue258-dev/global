import { describe, expect, it } from "vitest";
import { evaluateEligibility } from "./evaluate.js";

const profile = (p: Record<string, string> = {}) => ({ residence: "", level: "", grade: "", languages: "", ...p });
const s = (eligibleCountries: string[] | null = null) => ({ id: "a", eligibleCountries });

describe("evaluateEligibility", () => {
  it("perfil vazio → possível, só com pendências", () => {
    const r = evaluateEligibility(s(), { acceptedLevels: ["Mestrado"], needs: [] }, profile());
    expect(r.status).toBe("possible");
    expect(r.reasons.every((x) => x.kind === "missing")).toBe(true);
  });
  it("nível incompatível → não elegível", () => {
    expect(evaluateEligibility(s(), { acceptedLevels: ["Mestrado"], needs: [] }, profile({ residence: "X", level: "Graduação" })).status).toBe("not_eligible");
  });
  it("tudo atendido → elegível", () => {
    expect(evaluateEligibility(s(), { acceptedLevels: ["Mestrado"], needs: ["languages"] }, profile({ residence: "X", level: "Mestrado", languages: "Inglês C1" })).status).toBe("eligible");
  });
  it("sem critérios → elegível com motivo explícito", () => {
    expect(evaluateEligibility(s(), null, profile({ residence: "X", level: "Mestrado" })).reasons).toEqual([{ kind: "met", text: "Nenhuma restrição conhecida para o seu perfil." }]);
  });
  it("país sem acento e sem diferenciar maiúsculas", () => {
    expect(evaluateEligibility(s(["Suíça"]), null, profile({ residence: " SUICA ", level: "Mestrado" })).status).toBe("eligible");
  });
});
