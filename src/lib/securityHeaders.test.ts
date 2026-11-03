import { describe, expect, it } from "vitest";
import { apiOrigin, contentSecurityPolicy, securityHeaders } from "./securityHeaders";

describe("cabeçalhos de segurança", () => {
  it("libera só a origem da API em connect-src", () => {
    expect(apiOrigin("https://api.exemplo.com/api/v1")).toBe("https://api.exemplo.com");
    expect(apiOrigin("não é url")).toBeNull();
    expect(contentSecurityPolicy("https://api.exemplo.com/api")).toContain("connect-src 'self' https://api.exemplo.com;");
    expect(contentSecurityPolicy(undefined)).toContain("connect-src 'self';");
    expect(contentSecurityPolicy(undefined)).toContain("frame-ancestors 'none'");
  });

  it("CSP e HSTS só em produção", () => {
    const keys = (production: boolean) => securityHeaders({ production, apiBaseUrl: undefined }).map((h) => h.key);
    expect(keys(false)).not.toContain("Content-Security-Policy");
    expect(keys(true)).toEqual(expect.arrayContaining(["Content-Security-Policy", "Strict-Transport-Security", "X-Frame-Options"]));
  });
});
