import { describe, expect, it } from "vitest";
import { ACCEPT_ATTRIBUTE, ACCEPTED_LABELS, MAX_UPLOAD_BYTES, formatBytes, validateFile } from "./uploads";

const file = (name: string, size: number, type = "") => ({ name, size, type });

describe("validateFile", () => {
  it("aceita PDF, imagens e DOCX (por tipo ou extensão)", () => {
    expect(validateFile(file("diploma.pdf", 1000, "application/pdf"))).toBeNull();
    expect(validateFile(file("foto.JPEG", 1000))).toBeNull();
    expect(validateFile(file("carta.docx", 1000))).toBeNull();
  });

  it("recusa outros tipos, arquivo vazio e acima do limite", () => {
    expect(validateFile(file("virus.exe", 10, "application/x-msdownload"))).toBe("type");
    expect(validateFile(file("vazio.pdf", 0, "application/pdf"))).toBe("empty");
    expect(validateFile(file("grande.pdf", MAX_UPLOAD_BYTES + 1, "application/pdf"))).toBe("size");
  });

  it("expõe accept e rótulos sem duplicatas", () => {
    expect(ACCEPT_ATTRIBUTE).toContain(".pdf");
    expect(ACCEPTED_LABELS).toBe("PDF, JPG, PNG, DOCX");
  });
});

describe("formatBytes", () => {
  it("formata no idioma", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(10 * 1024 * 1024, "en-GB")).toBe("10 MB");
  });
});
