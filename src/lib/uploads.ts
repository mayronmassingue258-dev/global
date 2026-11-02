/** Regras de arquivo aceitas pelo frontend. O servidor deve validar de novo (tipo real do conteúdo, não só a extensão). */
export const ACCEPTED_FILES = [
  { mime: "application/pdf", ext: ".pdf", label: "PDF" },
  { mime: "image/jpeg", ext: ".jpg", label: "JPG" },
  { mime: "image/jpeg", ext: ".jpeg", label: "JPG" },
  { mime: "image/png", ext: ".png", label: "PNG" },
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: ".docx", label: "DOCX" }
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Valor para o atributo `accept` do <input type="file">. */
export const ACCEPT_ATTRIBUTE = [...new Set(ACCEPTED_FILES.flatMap((f) => [f.mime, f.ext]))].join(",");

export const ACCEPTED_LABELS = [...new Set(ACCEPTED_FILES.map((f) => f.label))].join(", ");

export type FileProblem = "type" | "size" | "empty";

/**
 * Aceita se o tipo MIME OU a extensão baterem (alguns sistemas não informam o MIME de .docx).
 * Devolve o problema encontrado, ou null.
 */
export function validateFile(file: Pick<File, "name" | "size" | "type">): FileProblem | null {
  const name = file.name.toLowerCase();
  const okType = ACCEPTED_FILES.some((f) => f.mime === file.type || name.endsWith(f.ext));
  if (!okType) return "type";
  if (file.size === 0) return "empty";
  if (file.size > MAX_UPLOAD_BYTES) return "size";
  return null;
}

export function formatBytes(bytes: number, locale = "pt-BR"): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}
