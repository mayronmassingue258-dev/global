import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { vi } from "vitest";
import pt from "./dictionaries/pt";
import en from "./dictionaries/en";
import { I18nProvider, useT } from "./I18nProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { isLocale } from "./config";
import { AuthForm } from "@/features/auth/AuthForm";

/** Lista os caminhos de todas as folhas (texto ou função) de um dicionário. */
function leaves(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

describe("dicionários", () => {
  it("inglês tem exatamente as mesmas chaves do português", () => {
    expect(leaves(en).sort()).toEqual(leaves(pt).sort());
  });

  it("nenhum texto vazio por engano (exceto notas opcionais)", () => {
    const empty = (d: unknown) => leaves(d).filter((path) => {
      const value = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d);
      return value === "";
    });
    expect(empty(pt)).toEqual(["detail.dataLanguageNote"]);
    expect(empty(en)).toEqual([]);
  });

  it("funções com plural funcionam nos dois idiomas", () => {
    expect(pt.scholarships.results(1)).toBe("1 resultado");
    expect(en.scholarships.results(2)).toBe("2 results");
    expect(en.deadline.daysLeft(3)).toBe("3 days left");
  });

  it("isLocale só aceita idiomas suportados", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});

describe("I18nProvider", () => {
  function Probe() {
    return <p>{useT().nav.dashboard}</p>;
  }

  it("sem provider usa português; com provider usa o idioma escolhido", () => {
    const { rerender } = render(<Probe />);
    expect(screen.getByText("Painel")).toBeInTheDocument();
    rerender(<I18nProvider locale="en"><Probe /></I18nProvider>);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("componentes reais aparecem em inglês", () => {
    render(<I18nProvider locale="en"><AuthForm mode="register" /></I18nProvider>);
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create free account" })).toBeInTheDocument();
  });
});

describe("LanguageSwitcher", () => {
  it("marca o idioma atual, grava a preferência e recarrega a rota", async () => {
    const refresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() });
    render(<I18nProvider locale="pt"><LanguageSwitcher /></I18nProvider>);
    expect(screen.getByRole("button", { name: "PT · Português" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "EN · English" }));
    expect(document.cookie).toContain("gs_locale=en");
    expect(document.documentElement.lang).toBe("en");
    expect(refresh).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "PT · Português" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
