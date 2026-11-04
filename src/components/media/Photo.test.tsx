import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Permite simular "arquivo ainda não adicionado" sem apagar fotos de verdade. (vi.mock é içado: tudo via vi.hoisted.)
const { missing, fsMock } = vi.hoisted(() => {
  const missing = new Set<string>();
  const fsMock = async (importOriginal: () => Promise<typeof import("node:fs")>) => {
    const fs = await importOriginal();
    const existsSync = (path: string) => (missing.has(String(path).split(/[\\/]/).pop()!) ? false : fs.existsSync(path));
    return { ...fs, existsSync, default: { ...fs, existsSync } };
  };
  return { missing, fsMock };
});
vi.mock("node:fs", fsMock);
vi.mock("fs", fsMock);

const { Photo } = await import("./Photo");

afterEach(() => missing.clear());

describe("Photo", () => {
  it.each(["hero", "building", "campus", "library"] as const)("usa next/image para %s (arquivo presente em public/images)", (name) => {
    render(<Photo name={name} alt="Foto" sizes="100vw" />);
    expect(screen.getByRole("img", { name: "Foto" })).toHaveAttribute("sizes", "100vw");
  });

  it("mostra painel decorativo quando a foto ainda não foi adicionada", () => {
    missing.add("campus.jpg");
    const { container } = render(<Photo name="campus" sizes="100vw" fallback={<span>01</span>} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const panel = container.querySelector('[data-photo-fallback="campus"]');
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveTextContent("01");
  });
});
