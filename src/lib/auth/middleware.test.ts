import { describe, expect, it } from "vitest";
import { config } from "@/middleware";
import { PROTECTED_PREFIXES } from "./routes";

describe("middleware", () => {
  it("protege exatamente as áreas de PROTECTED_PREFIXES (e as sub-rotas)", () => {
    expect(config.matcher).toEqual(PROTECTED_PREFIXES.flatMap((p) => [p, `${p}/:path*`]));
  });
});
