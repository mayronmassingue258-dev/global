import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "./AuthForm";

describe("AuthForm", () => {
  it("cadastro pede nome, e-mail e senha nova", () => {
    render(<AuthForm mode="register" />);
    expect(screen.getByLabelText("Nome completo")).toBeRequired();
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "new-password");
  });

  it("recuperação não pede senha", () => {
    render(<AuthForm mode="forgot" />);
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
  });

  it("deixa claro que a autenticação não está conectada (não finge login)", async () => {
    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("E-mail"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Senha"), "12345678");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByRole("status")).toHaveTextContent("ainda não está conectada");
  });
});

describe("AuthForm — validação", () => {
  it("mostra erros e coloca o foco no primeiro campo inválido", async () => {
    render(<AuthForm mode="register" />);
    await userEvent.type(screen.getByLabelText("E-mail"), "sem-arroba");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta gratuita" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Corrija os campos destacados");
    expect(screen.getByLabelText("Nome completo")).toHaveAccessibleDescription("Erro: Informe seu nome.");
    expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription("Erro: Informe um e-mail válido, como nome@exemplo.com.");
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription(/Erro: Informe sua senha/);
    await vi.waitFor(() => expect(screen.getByLabelText("Nome completo")).toHaveFocus());
    expect(screen.queryByText(/ainda não está conectada/)).not.toBeInTheDocument();
  });

  it("senha curta no cadastro", async () => {
    render(<AuthForm mode="register" />);
    await userEvent.type(screen.getByLabelText("Nome completo"), "Ana");
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    await userEvent.type(screen.getByLabelText("Senha"), "123");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta gratuita" }));
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription(/pelo menos 8 caracteres/);
  });
});
