import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/client";
import { fakeProfileService } from "@/test/fakes";
import { setupTestRouter } from "@/test/router";
import { ProfileForm } from "./ProfileForm";

const next = () => screen.getByRole("button", { name: "Salvar e continuar" });

describe("ProfileForm (perfil em etapas)", () => {
  it("carrega o perfil salvo, mostra a completude e as 6 etapas", async () => {
    setupTestRouter("/profile");
    render(<ProfileForm service={fakeProfileService({ nationalities: ["MZ"], residenceCountry: "MZ", fundingNeed: "full" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando perfil");
    expect(await screen.findByText("Perfil 25% completo")).toBeInTheDocument();
    const steps = within(screen.getByRole("navigation", { name: "Etapas do perfil" })).getAllByRole("button");
    expect(steps.map((b) => b.textContent)).toEqual(["1Origem", "2Formação", "3Idiomas", "4Experiência", "5Objetivos", "6Finanças"]);
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("list", { name: "Escolhidos em Nacionalidade(s)" })).toHaveTextContent("Moçambique");
    expect(screen.getByLabelText("País onde mora hoje")).toHaveValue("MZ");
  });

  it("adiciona e remove nacionalidades (no máximo 3) e salva ao avançar", async () => {
    setupTestRouter("/profile");
    const service = fakeProfileService();
    render(<ProfileForm service={service} />);
    const add = await screen.findByRole("combobox", { name: "Nacionalidade(s)" });
    await userEvent.selectOptions(add, "AO");
    await userEvent.selectOptions(add, "PT");
    await userEvent.click(screen.getByRole("button", { name: "Remover Portugal" }));
    await userEvent.selectOptions(screen.getByLabelText("País onde mora hoje"), "MZ");
    await userEvent.type(screen.getByLabelText("Ano de nascimento"), "2001");
    await userEvent.click(screen.getByLabelText("Mulheres"));
    await userEvent.click(next());

    await waitFor(() => expect(service.calls).toHaveLength(1), { timeout: 3000 });
    expect(service.calls[0]).toMatchObject({ nationalities: ["AO"], residenceCountry: "MZ", birthYear: 2001, groups: ["women"] });
    const heading = await screen.findByRole("heading", { name: "O que você já estudou" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText("Etapa 2 de 6")).toBeInTheDocument();
  });

  it("nota com vírgula decimal e escala; nota acima da escala mostra erro e não salva", async () => {
    setupTestRouter("/profile");
    const service = fakeProfileService();
    render(<ProfileForm service={service} initialStep={1} />);
    await userEvent.type(await screen.findByLabelText("Média final"), "21");
    await userEvent.selectOptions(screen.getByLabelText("Escala da nota"), "20");
    await userEvent.click(next());
    expect(screen.getByRole("alert")).toHaveTextContent("Corrija os campos destacados");
    expect(screen.getByLabelText("Média final")).toHaveAccessibleDescription(/fora do intervalo/);
    expect(service.calls).toHaveLength(0);

    await userEvent.clear(screen.getByLabelText("Média final"));
    await userEvent.type(screen.getByLabelText("Média final"), "14,5");
    await userEvent.click(screen.getByLabelText("Engenharias"));
    await userEvent.click(next());
    await waitFor(() => expect(service.calls).toHaveLength(1));
    expect(service.calls[0]).toMatchObject({ gpa: { value: 14.5, scale: "20" }, fields: ["engineering"] });
  });

  it("limita as áreas a 3", async () => {
    setupTestRouter("/profile");
    render(<ProfileForm service={fakeProfileService({ fields: ["law", "education", "agriculture"] })} initialStep={1} />);
    expect(await screen.findByLabelText("Engenharias")).toBeDisabled();
    expect(screen.getByLabelText("Direito")).toBeEnabled();
  });

  it("idiomas e testes: adiciona linhas; teste sem nota não salva", async () => {
    setupTestRouter("/profile");
    const service = fakeProfileService();
    render(<ProfileForm service={service} initialStep={2} />);
    await userEvent.click(await screen.findByRole("button", { name: "Adicionar idioma" }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar idioma" }));
    const levels = screen.getAllByLabelText("Nível");
    await userEvent.selectOptions(levels[1]!, "C1");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar teste" }));
    await userEvent.click(next());
    expect(screen.getByRole("alert")).toHaveTextContent("Corrija");
    expect(service.calls).toHaveLength(0);

    await userEvent.type(screen.getByLabelText("Nota"), "7");
    await userEvent.click(next());
    await waitFor(() => expect(service.calls).toHaveLength(1));
    expect(service.calls[0]).toMatchObject({
      languages: [{ code: "pt", level: "native" }, { code: "en", level: "C1" }],
      tests: [{ type: "ielts", score: 7 }]
    });
  });

  it("última etapa: salva e leva às bolsas recomendadas", async () => {
    const nav = setupTestRouter("/profile");
    const service = fakeProfileService();
    render(<ProfileForm service={service} initialStep={5} />);
    await userEvent.click(await screen.findByLabelText("Preciso de bolsa integral (propinas e sustento)"));
    await userEvent.click(screen.getByLabelText("Não"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar e ver bolsas para mim" }));
    await waitFor(() => expect(nav.router.push).toHaveBeenCalledWith("/recommendations"));
    expect(service.calls[0]).toMatchObject({ fundingNeed: "full", canPayApplicationFee: false });
  });

  it("erro 422 do servidor leva à etapa do campo e marca o erro", async () => {
    setupTestRouter("/profile");
    const service = fakeProfileService({}, { updateError: new ApiError(422, "x", "validation_failed", { startYear: "out_of_range" }) });
    render(<ProfileForm service={service} initialStep={0} />);
    await userEvent.click(await screen.findByRole("button", { name: "Salvar e continuar" }));
    expect(await screen.findByText("Etapa 5 de 6")).toBeInTheDocument();
    expect(screen.getByLabelText("Quando quer começar")).toHaveAttribute("aria-invalid", "true");
  });

  it("recupera o que foi digitado e não salvo (e permite descartar)", async () => {
    setupTestRouter("/profile");
    window.sessionStorage.clear();
    const service = fakeProfileService({ nationalities: ["MZ"] });
    const first = render(<ProfileForm service={service} />);
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Nacionalidade(s)" }), "AO");
    expect(screen.getByText("Há alterações não salvas.")).toBeInTheDocument();
    first.unmount();

    render(<ProfileForm service={service} />);
    expect(await screen.findByText(/Recuperamos o que você tinha digitado/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Escolhidos em Nacionalidade(s)" })).toHaveTextContent("Angola");
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.getByRole("list", { name: "Escolhidos em Nacionalidade(s)" })).not.toHaveTextContent("Angola");
    expect(screen.queryByText(/Recuperamos/)).not.toBeInTheDocument();
  });

  it("falha ao carregar oferece tentar de novo", async () => {
    setupTestRouter("/profile");
    render(<ProfileForm service={fakeProfileService({}, { failGet: true })} />);
    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});
