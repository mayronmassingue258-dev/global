import { ApiError, apiRequest } from "./client";
import { isAttachedFile } from "./guards";
import { API_BASE_URL } from "@/lib/config";
import type { AttachedFile } from "@/types";

export type UploadedFile = AttachedFile;

const filePath = (applicationId: string, documentName: string) =>
  `/applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentName)}/file`;

/** Envia o arquivo de um item do checklist (multipart/form-data, campo `file`). Substitui o anterior. */
export async function uploadApplicationDocument(applicationId: string, documentName: string, file: File, signal?: AbortSignal): Promise<UploadedFile> {
  const form = new FormData();
  form.append("file", file, file.name);
  const data = await apiRequest<unknown>(filePath(applicationId, documentName), { method: "PUT", rawBody: form, signal });
  if (!isAttachedFile(data)) throw new ApiError(502, "Resposta inesperada do servidor.", "unexpected_response");
  return data;
}

export async function deleteApplicationDocument(applicationId: string, documentName: string): Promise<void> {
  try {
    await apiRequest<void>(filePath(applicationId, documentName), { method: "DELETE" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return;
    throw error;
  }
}

/** Link de download (mesmo domínio do site, com o cookie de sessão). */
export function documentDownloadUrl(applicationId: string, documentName: string): string {
  return `${API_BASE_URL ?? ""}${filePath(applicationId, documentName)}`;
}
