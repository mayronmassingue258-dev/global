import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "./AuthForm";
import { ApiError } from "@/lib/api/client";
import type { AuthService } from "@/lib/api/auth";
import { setupTestRouter } from "@/test/router";

function fakeAuth(overrides: Partial<AuthService> = {}): AuthService & { calls: string[] } {
  const calls: string[] = [];
  const user = { id: "u1", email: "ana@exemplo.com", name: "Ana" };
  return {
    calls,
    me: async () => user,
    register: async (input) => { calls.push(`register:${input.email}`); return user; },
    login: async (email) => { calls.push(`login:${email}`); return user; },
    logout: async () => {},
    forgotPassword: async (email) => { calls.push(`forgot:${email}`); },
    resetPassword: async () => {},
    deleteAccount: async () => {},
    ...overrides
  };
}

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

describe("AuthForm — integração com o backend", () => {
  it("login certo leva ao destino de ?next= (só caminhos internos)", async () => {
    const nav = setupTestRouter("/login?next=%2Fapplications%3Fx%3D1");
    const service = fakeAuth();
    render(<AuthForm mode="login" service={service} />);
    await userEvent.type(screen.getByLabelText("E-mail"), " ana@exemplo.com ");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-segura-1");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await vi.waitFor(() => expect(nav.current()).toBe("/applications?x=1"));
    expect(service.calls).toEqual(["login:ana@exemplo.com"]);
    expect(nav.router.refresh).toHaveBeenCalled();
  });

  it("?next= para outro site é ignorado (vai para o painel)", async () => {
    const nav = setupTestRouter("/login?next=https%3A%2F%2Fmalicioso.example");
    render(<AuthForm mode="login" service={fakeAuth()} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-segura-1");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await vi.waitFor(() => expect(nav.current()).toBe("/dashboard"));
  });

  it("senha errada: mensagem geral, senha apagada e foco nela", async () => {
    setupTestRouter("/login");
    render(<AuthForm mode="login" service={fakeAuth({ login: async () => { throw new ApiError(401, "x", "invalid_credentials"); } })} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    await userEvent.type(screen.getByLabelText("Senha"), "errada-errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("E-mail ou senha incorretos.")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    await vi.waitFor(() => expect(screen.getByLabelText("Senha")).toHaveFocus());
  });

  it("cadastro com e-mail já usado marca o campo de e-mail", async () => {
    setupTestRouter("/register");
    render(<AuthForm mode="register" service={fakeAuth({ register: async () => { throw new ApiError(409, "x", "email_taken", { email: "taken" }); } })} />);
    await userEvent.type(screen.getByLabelText("Nome completo"), "Ana");
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-segura-1");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta gratuita" }));
    await vi.waitFor(() => expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription(/Já existe uma conta com este e-mail/));
  });

  it("muitas tentativas (429) e falha de rede têm mensagens próprias", async () => {
    setupTestRouter("/login");
    const { unmount } = render(<AuthForm mode="login" service={fakeAuth({ login: async () => { throw new ApiError(429, "x", "rate_limited"); } })} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Senha"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText(/Muitas tentativas/)).toBeInTheDocument();
    unmount();
    render(<AuthForm mode="login" service={fakeAuth({ login: async () => { throw new ApiError(0, "x", "network_error"); } })} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Senha"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText(/Não foi possível concluir agora/)).toBeInTheDocument();
  });

  it("esqueci a senha: mesma mensagem, exista ou não a conta", async () => {
    setupTestRouter("/forgot-password");
    const service = fakeAuth();
    render(<AuthForm mode="forgot" service={service} />);
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    await userEvent.click(screen.getByRole("button", { name: "Enviar instruções" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Se houver uma conta com este e-mail");
    expect(service.calls).toEqual(["forgot:ana@exemplo.com"]);
  });
});
