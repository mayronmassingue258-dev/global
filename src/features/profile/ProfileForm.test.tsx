import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/client";
import { fakeProfileService } from "@/test/fakes";
import { ProfileForm } from "./ProfileForm";

describe("ProfileForm", () => {
  it("carrega o perfil salvo", async () => {
    render(<ProfileForm service={fakeProfileService({ residence: "Angola", level: "Mestrado" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando perfil");
    expect(await screen.findByLabelText("País de residência")).toHaveValue("Angola");
    expect(screen.getByLabelText("Nível de estudo atual")).toHaveValue("Mestrado");
  });

  it("valida, mostra erros e coloca o foco no primeiro campo inválido", async () => {
    const service = fakeProfileService();
    render(<ProfileForm service={service} />);
    await userEvent.click(await screen.findByRole("button", { name: "Salvar perfil" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Corrija os campos destacados");
    expect(screen.getByLabelText("País de residência")).toHaveAccessibleDescription(/Informe o país de residência/);
    expect(screen.getByLabelText("Nível de estudo atual")).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(screen.getByLabelText("País de residência")).toHaveFocus());
    expect(service.calls).toHaveLength(0);
  });

  it("limpa o erro do campo ao digitar", async () => {
    render(<ProfileForm service={fakeProfileService()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Salvar perfil" }));
    await userEvent.type(screen.getByLabelText("País de residência"), "Brasil");
    expect(screen.getByLabelText("País de residência")).not.toHaveAttribute("aria-invalid");
  });

  it("salva e confirma", async () => {
    const service = fakeProfileService();
    render(<ProfileForm service={service} />);
    await userEvent.type(await screen.findByLabelText("País de residência"), "Moçambique");
    await userEvent.selectOptions(screen.getByLabelText("Nível de estudo atual"), "Graduação");
    await userEvent.type(screen.getByLabelText("Idiomas e níveis (opcional)"), "Inglês B2");
    await userEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));

    expect(await screen.findByText("Perfil salvo.")).toBeInTheDocument();
    expect(service.calls[0]).toMatchObject({ residence: "Moçambique", level: "Graduação", languages: "Inglês B2" });
  });

  it("mostra erros de campo devolvidos pelo servidor (422)", async () => {
    const service = fakeProfileService({}, { updateError: new ApiError(422, "x", "validation_failed", { level: "required" }) });
    render(<ProfileForm service={service} />);
    await userEvent.type(await screen.findByLabelText("País de residência"), "Moçambique");
    await userEvent.selectOptions(screen.getByLabelText("Nível de estudo atual"), "Graduação");
    await userEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    await waitFor(() => expect(screen.getByLabelText("Nível de estudo atual")).toHaveAttribute("aria-invalid", "true"));
    await waitFor(() => expect(screen.getByLabelText("Nível de estudo atual")).toHaveFocus());
  });

  it("falha genérica ao salvar é anunciada", async () => {
    const service = fakeProfileService({ residence: "MZ", level: "Mestrado" }, { updateError: new ApiError(500, "x") });
    render(<ProfileForm service={service} />);
    await userEvent.click(await screen.findByRole("button", { name: "Salvar perfil" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar o perfil");
  });

  it("erro ao carregar oferece nova tentativa", async () => {
    render(<ProfileForm service={fakeProfileService({}, { failGet: true })} />);
    expect(await screen.findByText("Não foi possível carregar seu perfil")).toBeInTheDocument();
  });
});
