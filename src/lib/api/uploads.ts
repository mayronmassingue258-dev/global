import { ApiError, apiRequest } from "./client";

export type UploadedFile = { name: string; size: number; type: string; uploadedAt: string };

function isUploadedFile(v: unknown): v is UploadedFile {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.name === "string" && typeof r.size === "number" && typeof r.type === "string" && typeof r.uploadedAt === "string";
}

/**
 * PROPOSTA (docs/api-contract.md, "Arquivos"): envia o arquivo de um item do checklist como multipart/form-data, campo `file`.
 * Só é chamada quando NEXT_PUBLIC_UPLOADS_ENABLED=true.
 */
export async function uploadApplicationDocument(applicationId: string, documentName: string, file: File, signal?: AbortSignal): Promise<UploadedFile> {
  const form = new FormData();
  form.append("file", file, file.name);
  const data = await apiRequest<unknown>(
    `/applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentName)}/file`,
    { method: "PUT", rawBody: form, signal }
  );
  if (!isUploadedFile(data)) throw new ApiError(502, "Resposta inesperada do servidor.", "unexpected_response");
  return data;
}
