import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState, ErrorState, Notice } from "./States";

describe("feedback", () => {
  it("Notice só vira região viva quando pedido", () => {
    const { rerender } = render(<Notice>Info</Notice>);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    rerender(<Notice role="alert">Erro</Notice>);
    expect(screen.getByRole("alert")).toHaveTextContent("Erro");
  });

  it("EmptyState mostra título, descrição e ação", () => {
    render(<EmptyState title="Nada aqui" description="Tente outra busca." action={<a href="/x">Buscar</a>} />);
    expect(screen.getByText("Nada aqui")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buscar" })).toBeInTheDocument();
  });

  it("ErrorState anuncia o erro e permite tentar de novo", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
