import type { ApplicationService } from "@/lib/api/applications";
import type { ProfileService } from "@/lib/api/profile";
import { ApiError } from "@/lib/api/client";
import { emptyProfile } from "@/lib/validation/profile";
import type { Application, Profile, Scholarship } from "@/types";

export function makeScholarship(overrides: Partial<Scholarship> = {}): Scholarship {
  return {
    id: "s-1",
    title: "Bolsa de Teste em Física",
    institution: "Universidade de Teste",
    country: "Portugal",
    level: "Mestrado",
    fundingType: "Integral",
    funding: "Cobertura integral (teste).",
    deadline: "2027-01-31",
    summary: "Resumo de teste.",
    requirements: ["Diploma"],
    requiredDocuments: ["Diploma"],
    verification: { status: "unverified" },
    ...overrides
  };
}

export function makeApplication(overrides: Partial<Application> = {}): Application {
  const s = makeScholarship();
  return {
    id: s.id,
    scholarship: { id: s.id, title: s.title, institution: s.institution, deadline: s.deadline },
    status: "Saved",
    updatedAt: "2026-10-01T10:00:00.000Z",
    ...overrides
  };
}

/** Serviço de candidaturas em memória com falhas controláveis para testar carregamento, erro e reversão. */
export function fakeApplicationService(initial: Application[] = [], opts: { failList?: boolean; failMutations?: boolean } = {}) {
  let items = [...initial];
  const fail = () => Promise.reject(new ApiError(503, "falha simulada"));
  const service: ApplicationService & { items: () => Application[] } = {
    items: () => items,
    list: () => (opts.failList ? fail() : Promise.resolve([...items])),
    save: (s) => {
      if (opts.failMutations) return fail();
      const created: Application = { id: s.id, scholarship: s, status: "Saved", updatedAt: new Date().toISOString() };
      items = [...items.filter((a) => a.id !== s.id), created];
      return Promise.resolve(created);
    },
    update: (id, update) => {
      if (opts.failMutations) return fail();
      items = items.map((a) => (a.id === id ? { ...a, ...update } : a));
      return Promise.resolve(items.find((a) => a.id === id)!);
    },
    remove: (id) => {
      if (opts.failMutations) return fail();
      items = items.filter((a) => a.id !== id);
      return Promise.resolve();
    }
  };
  return service;
}

export function fakeProfileService(initial: Partial<Profile> = {}, opts: { failGet?: boolean; updateError?: ApiError } = {}) {
  let profile: Profile = { ...emptyProfile, ...initial };
  const calls: Profile[] = [];
  const service: ProfileService & { calls: Profile[] } = {
    calls,
    get: () => (opts.failGet ? Promise.reject(new ApiError(500, "x")) : Promise.resolve({ ...profile })),
    update: (input) => {
      calls.push(input);
      if (opts.updateError) return Promise.reject(opts.updateError);
      profile = { ...input, updatedAt: "2026-11-01T00:00:00.000Z" };
      return Promise.resolve({ ...profile });
    }
  };
  return service;
}

/** Resposta JSON para simular `fetch`. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
