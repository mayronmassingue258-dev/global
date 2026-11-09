import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider, useSessionUser } from "@/features/auth/SessionProvider";
import { setupTestRouter } from "@/test/router";

const logout = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/services", () => ({ authService: { logout: () => logout() } }));
const { AppHeader } = await import("./AppHeader");

describe("AppHeader com sessão", () => {
  it("logado: mostra o nome e 'Sair' encerra a sessão e volta para o início", async () => {
    const nav = setupTestRouter("/dashboard");
    render(<SessionProvider user={{ id: "u1", email: "ana@exemplo.com", name: "Ana Silva" }}><AppHeader /></SessionProvider>);
    expect(screen.getByText("Conectado como Ana Silva")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(logout).toHaveBeenCalledOnce();
    await waitFor(() => expect(nav.current()).toBe("/"));
    expect(nav.router.refresh).toHaveBeenCalled();
  });

  it("visitante: link para entrar que volta à página atual", () => {
    setupTestRouter("/scholarships");
    render(<SessionProvider user={null}><AppHeader /></SessionProvider>);
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login?next=%2Fscholarships");
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
  });
});

describe("useSessionUser", () => {
  function Probe() {
    const user = useSessionUser();
    return <p>{user ? user.name : "visitante"}</p>;
  }
  it("dentro do provider devolve o estudante ou null; fora, um estudante de teste", () => {
    const { rerender } = render(<SessionProvider user={null}><Probe /></SessionProvider>);
    expect(screen.getByText("visitante")).toBeInTheDocument();
    rerender(<Probe />);
    expect(screen.getByText("Teste")).toBeInTheDocument();
  });
});
