import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("marca a seção atual com aria-current, inclusive em sub-rotas", () => {
    vi.mocked(usePathname).mockReturnValue("/eligibility/amostra-001");
    render(<AppHeader />);
    const nav = screen.getByRole("navigation", { name: "Área do estudante" });
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("Bolsas");
    expect(screen.getByRole("link", { name: "Painel" })).not.toHaveAttribute("aria-current");
  });
});
