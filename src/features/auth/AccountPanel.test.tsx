import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/client";
import { mockAuthService } from "@/mocks/authService";
import { SessionProvider } from "./SessionProvider";
import { setupTestRouter } from "@/test/router";
import { AccountPanel } from "./AccountPanel";

const user = { id: "u1", email: "ana@exemplo.com", name: "Ana Silva" };

describe("AccountPanel", () => {
  it("mostra a conta e o link para baixar os dados", () => {
    setupTestRouter("/account");
    render(<SessionProvider user={user}><AccountPanel service={mockAuthService} /></SessionProvider>);
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expect(screen.getByText("ana@exemplo.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar meus dados (JSON)" })).toHaveAttribute("href", "http://api.test/api/auth/me/export");
  });

  it("excluir pede a senha, avisa senha errada e, com a certa, sai para o início", async () => {
    const nav = setupTestRouter("/account");
    const deleteAccount = vi.fn()
      .mockRejectedValueOnce(new ApiError(422, "x", "validation_failed", { password: "incorrect" }))
      .mockResolvedValueOnce(undefined);
    render(<SessionProvider user={user}><AccountPanel service={{ ...mockAuthService, deleteAccount }} /></SessionProvider>);
    const button = screen.getByRole("button", { name: "Excluir minha conta para sempre" });

    await userEvent.click(button);
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Para confirmar, digite a sua senha")).toHaveFocus();

    await userEvent.type(screen.getByLabelText("Para confirmar, digite a sua senha"), "errada");
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Senha incorreta.");

    await userEvent.type(screen.getByLabelText("Para confirmar, digite a sua senha"), "senha-certa-1");
    await userEvent.click(button);
    await vi.waitFor(() => expect(nav.current()).toBe("/"));
    expect(deleteAccount).toHaveBeenLastCalledWith("senha-certa-1");
  });
});
