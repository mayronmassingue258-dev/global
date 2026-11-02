import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("com o envio ligado, envia e confirma; falha permite tentar de novo", async () => {
    const upload = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({});
    render(<DocumentUpload applicationId="app-1" documentName="Diploma" enabled upload={upload} />);
    await userEvent.upload(screen.getByLabelText("Arquivo para “Diploma”"), pdf());
    await userEvent.click(screen.getByRole("button", { name: "Enviar arquivo" }));
    expect(await screen.findByText("Não foi possível enviar o arquivo. Tente novamente.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enviar arquivo" }));
    expect(await screen.findByText("diploma.pdf enviado.")).toBeInTheDocument();
    expect(upload).toHaveBeenLastCalledWith("app-1", "Diploma", expect.any(File));
  });
});
