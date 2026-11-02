import { describe, expect, it } from "vitest";
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
