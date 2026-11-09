import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/client";
import { DocumentUpload } from "./DocumentUpload";

const pdf = (size = 2048) => new File([new Uint8Array(size)], "diploma.pdf", { type: "application/pdf" });

describe("DocumentUpload", () => {
  it("recusa tipo não aceito, com mensagem anunciada", async () => {
    render(<DocumentUpload applicationId="a" documentName="Diploma" />);
    // applyAccept: false simula alguém contornando o filtro do seletor de arquivos.
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(screen.getByLabelText("Arquivo para “Diploma”"), new File(["x"], "foto.gif", { type: "image/gif" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Tipo de arquivo não aceito. Use PDF, JPG, PNG, DOCX.");
  });

  it("recusa arquivo grande demais", async () => {
    render(<DocumentUpload applicationId="a" documentName="Diploma" />);
    const big = pdf();
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    await userEvent.upload(screen.getByLabelText("Arquivo para “Diploma”"), big);
    expect(screen.getByRole("alert")).toHaveTextContent("O arquivo passa do limite de 10 MB.");
  });

  it("com o envio desligado, valida e deixa claro que nada foi enviado", async () => {
    const upload = vi.fn();
    render(<DocumentUpload applicationId="a" documentName="Diploma" enabled={false} upload={upload} />);
    await userEvent.upload(screen.getByLabelText("Arquivo para “Diploma”"), pdf());
    expect(screen.getByText("diploma.pdf (2 KB) pronto para envio.")).toBeInTheDocument();
    expect(screen.getByText(/não saiu do seu computador/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar arquivo" })).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Remover arquivo" }));
    expect(screen.queryByText(/pronto para envio/)).not.toBeInTheDocument();
  });

  it("com o envio ligado, o arquivo sobe assim que é escolhido e avisa a candidatura", async () => {
    const saved = { name: "diploma.pdf", size: 2048, type: "application/pdf", uploadedAt: "2026-11-09T10:00:00Z" };
    const upload = vi.fn().mockResolvedValue(saved);
    const onChange = vi.fn();
    render(<DocumentUpload applicationId="app-1" documentName="Diploma" enabled upload={upload} onChange={onChange} />);
    await userEvent.upload(screen.getByLabelText("Arquivo para “Diploma”"), pdf());
    expect(upload).toHaveBeenCalledWith("app-1", "Diploma", expect.any(File));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(saved));
  });

  it("falha de envio e recusa pelo conteúdo têm mensagens próprias", async () => {
    const upload = vi.fn()
      .mockRejectedValueOnce(new Error("rede"))
      .mockRejectedValueOnce(new ApiError(422, "x", "validation_failed", { file: "invalid_type" }));
    render(<DocumentUpload applicationId="a" documentName="Diploma" enabled upload={upload} />);
    await userEvent.upload(screen.getByLabelText("Arquivo para “Diploma”"), pdf());
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível enviar o arquivo");
    await userEvent.upload(screen.getByLabelText("Arquivo para “Diploma”"), pdf());
    expect(await screen.findByRole("alert")).toHaveTextContent("não é PDF, JPG, PNG nem DOCX válido");
  });

  it("arquivo já anexado: link para baixar e remover", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const onChange = vi.fn();
    const current = { name: "meu diploma.pdf", size: 3 * 1024, type: "application/pdf", uploadedAt: "2026-11-09T10:00:00Z" };
    render(<DocumentUpload applicationId="app 1" documentName="Diploma" enabled current={current} remove={remove} onChange={onChange} />);
    const link = screen.getByRole("link", { name: "Baixar meu diploma.pdf (3 KB)" });
    expect(link).toHaveAttribute("href", "http://api.test/api/applications/app%201/documents/Diploma/file");
    expect(screen.getByText("Trocar arquivo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remover arquivo" }));
    expect(remove).toHaveBeenCalledWith("app 1", "Diploma");
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  });
});
