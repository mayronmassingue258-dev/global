import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { SelectField, TextAreaField, TextField } from "./Field";

describe("Button", () => {
  it("é type=button por padrão (não envia formulários sem querer)", () => {
    render(<Button>Ação</Button>);
    expect(screen.getByRole("button", { name: "Ação" })).toHaveAttribute("type", "button");
  });

  it("em carregamento fica desabilitado e com aria-busy", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Salvar</Button>);
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Badge", () => {
  it("renderiza o texto", () => {
    render(<Badge tone="success">Elegível</Badge>);
    expect(screen.getByText("Elegível")).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("liga rótulo, ajuda e erro ao controle", () => {
    render(<TextField label="E-mail" helper="Use seu e-mail pessoal." error="Informe o e-mail." />);
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Use seu e-mail pessoal. Erro: Informe o e-mail.");
  });

  it("sem erro não marca aria-invalid nem aria-describedby", () => {
    render(<TextField label="Nome" />);
    const input = screen.getByLabelText("Nome");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("indica campos opcionais no rótulo", () => {
    render(<TextAreaField label="Notas" optional />);
    expect(screen.getByLabelText("Notas (opcional)")).toBeInTheDocument();
  });

  it("select funciona com opções", async () => {
    render(<SelectField label="Nível" defaultValue=""><option value="">Todos</option><option value="M">Mestrado</option></SelectField>);
    await userEvent.selectOptions(screen.getByLabelText("Nível"), "M");
    expect(screen.getByLabelText("Nível")).toHaveValue("M");
  });
});
