import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("aplica padrões e valida", () => {
    const c = loadConfig({ DATABASE_URL: "postgres://u@h:5432/db" });
    expect(c).toMatchObject({ PORT: 4000, NODE_ENV: "development", ALLOW_TEST_RESET: "0" });
  });
  it("recusa DATABASE_URL ausente ou inválida, com mensagem clara", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: "não é url" })).toThrow(/DATABASE_URL/);
  });
  it("proíbe a rota de reset em produção", () => {
    expect(() => loadConfig({ DATABASE_URL: "postgres://u@h/db", NODE_ENV: "production", ALLOW_TEST_RESET: "1" })).toThrow(/produção/);
  });
});
