import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/client";
import { mockAuthService } from "@/mocks/authService";
import { setupTestRouter } from "@/test/router";
import { ResetPasswordForm } from "./ResetPasswordForm";

describe("ResetPasswordForm", () => {
  it("sem token na URL, oferece pedir um novo link", () => {
    setupTestRouter("/reset-password");
    render(<ResetPasswordForm service={mockAuthService} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Este link não vale mais");
    expect(screen.getByRole("link", { name: "Pedir um novo link" })).toHaveAttribute("href", "/forgot-password");
  });

  it("valida a nova senha e confirma a troca", async () => {
    setupTestRouter("/reset-password?token=abc");
    const resetPassword = vi.fn().mockResolvedValue(undefined);
    render(<ResetPasswordForm service={{ ...mockAuthService, resetPassword }} />);
    await userEvent.type(screen.getByLabelText("Nova senha"), "123");
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(screen.getByLabelText("Nova senha")).toHaveAccessibleDescription(/pelo menos 8 caracteres/);
    await userEvent.type(screen.getByLabelText("Nova senha"), "45678");
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Senha alterada");
    expect(resetPassword).toHaveBeenCalledWith("abc", "12345678");
  });

  it("token vencido mostra como pedir outro", async () => {
    setupTestRouter("/reset-password?token=velho");
    const resetPassword = vi.fn().mockRejectedValue(new ApiError(400, "x", "invalid_token"));
    render(<ResetPasswordForm service={{ ...mockAuthService, resetPassword }} />);
    await userEvent.type(screen.getByLabelText("Nova senha"), "senha-nova-123");
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(await screen.findByRole("link", { name: "Pedir um novo link" })).toBeInTheDocument();
  });
});
