import { beforeEach, describe, expect, it } from "vitest";
import { emptyProfile } from "@/lib/validation/profile";
import { mockScholarshipService } from "./scholarshipService";
import { __resetMockApplications, mockApplicationService } from "./applicationService";
import { __resetMockProfile, mockProfileService } from "./profileService";
import { scholarships } from "./scholarships";

describe("mockScholarshipService", () => {
  it("ordena por prazo por padrão", async () => {
    const { items } = await mockScholarshipService.list({});
    const deadlines = items.map((i) => i.deadline);
    expect(deadlines).toEqual([...deadlines].sort());
  });

  it("filtra por texto, país e nível", async () => {
    expect((await mockScholarshipService.list({ search: "dados" })).items.map((i) => i.id)).toEqual(["amostra-001"]);
    expect((await mockScholarshipService.list({ country: "reino" })).total).toBe(2);
    expect((await mockScholarshipService.list({ level: "Doutorado" })).total).toBe(1);
  });

  it("pagina", async () => {
    const page2 = await mockScholarshipService.list({ page: 2, pageSize: 4 });
    expect(page2.items).toHaveLength(scholarships.length - 4);
    expect(page2.total).toBe(scholarships.length);
  });

  it("get e eligibility devolvem null para id desconhecido", async () => {
    expect(await mockScholarshipService.get("nao-existe")).toBeNull();
    expect(await mockScholarshipService.eligibility("nao-existe")).toBeNull();
    expect(await mockScholarshipService.get("amostra-001")).toMatchObject({ id: "amostra-001" });
  });

  it("todos os dados fictícios estão marcados como não verificados", () => {
    expect(scholarships.every((s) => s.verification.status === "unverified")).toBe(true);
  });
});

describe("mockApplicationService", () => {
  beforeEach(() => __resetMockApplications());

  it("salvar é idempotente", async () => {
    const s = scholarships[0]!;
    await mockApplicationService.save(s);
    await mockApplicationService.save(s);
    expect(await mockApplicationService.list()).toHaveLength(1);
  });

  it("atualiza status e remove", async () => {
    const s = scholarships[0]!;
    await mockApplicationService.save(s);
    expect(await mockApplicationService.update(s.id, { status: "Submitted" })).toMatchObject({ status: "Submitted" });
    await mockApplicationService.remove(s.id);
    expect(await mockApplicationService.list()).toEqual([]);
  });

  it("update de id inexistente falha com 404", async () => {
    await expect(mockApplicationService.update("x", { status: "Saved" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("mockProfileService", () => {
  beforeEach(() => __resetMockProfile());

  it("valida como o servidor (422 com campos)", async () => {
    await expect(mockProfileService.update(emptyProfile)).rejects.toMatchObject({ status: 422, fields: { residence: "required", level: "required" } });
  });

  it("guarda e devolve o perfil", async () => {
    await mockProfileService.update({ ...emptyProfile, residence: "Angola", level: "Graduação" });
    expect(await mockProfileService.get()).toMatchObject({ residence: "Angola", level: "Graduação" });
  });
});
