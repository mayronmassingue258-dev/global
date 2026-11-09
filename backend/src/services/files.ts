import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { applicationDocuments, documentFiles } from "../db/schema.js";
import { HttpError, notFound, validationFailed } from "../lib/errors.js";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type FileMeta = { name: string; size: number; type: string; uploadedAt: string };

const PDF = "application/pdf";
const PNG = "image/png";
const JPEG = "image/jpeg";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Descobre o tipo pelo CONTEÚDO (assinatura dos primeiros bytes), não pela extensão nem pelo que o navegador diz:
 * um executável renomeado para .pdf é recusado. DOCX é um ZIP que contém word/document.xml.
 */
export function detectFileType(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") return PDF;
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return PNG;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return JPEG;
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && buffer.includes("word/document.xml")) return DOCX;
  return null;
}

/** Nome seguro para guardar e devolver no download: sem caminhos, sem caracteres de controle, tamanho limitado. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "arquivo";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 150);
  return cleaned || "arquivo";
}

const toMeta = (f: { fileName: string; size: number; contentType: string; uploadedAt: Date }): FileMeta => ({
  name: f.fileName,
  size: f.size,
  type: f.contentType,
  uploadedAt: f.uploadedAt.toISOString()
});

async function ensureDocument(db: Database, userId: string, scholarshipId: string, documentName: string) {
  const [doc] = await db.select({ name: applicationDocuments.name }).from(applicationDocuments)
    .where(and(eq(applicationDocuments.userId, userId), eq(applicationDocuments.scholarshipId, scholarshipId), eq(applicationDocuments.name, documentName)))
    .limit(1);
  if (!doc) throw notFound();
}

export async function saveFile(db: Database, userId: string, scholarshipId: string, documentName: string, file: { fileName: string; buffer: Buffer }) {
  await ensureDocument(db, userId, scholarshipId, documentName);
  if (file.buffer.length === 0) throw validationFailed({ file: "empty" });
  if (file.buffer.length > MAX_FILE_BYTES) throw new HttpError(413, "payload_too_large");
  const contentType = detectFileType(file.buffer);
  if (!contentType) throw validationFailed({ file: "invalid_type" });
  const row = { userId, scholarshipId, documentName, fileName: cleanFileName(file.fileName), contentType, size: file.buffer.length, content: file.buffer, uploadedAt: new Date() };
  await db.insert(documentFiles).values(row).onConflictDoUpdate({
    target: [documentFiles.userId, documentFiles.scholarshipId, documentFiles.documentName],
    set: { fileName: row.fileName, contentType, size: row.size, content: row.content, uploadedAt: row.uploadedAt }
  });
  return toMeta(row);
}

export async function readFile(db: Database, userId: string, scholarshipId: string, documentName: string) {
  const [row] = await db.select().from(documentFiles)
    .where(and(eq(documentFiles.userId, userId), eq(documentFiles.scholarshipId, scholarshipId), eq(documentFiles.documentName, documentName)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export async function deleteFile(db: Database, userId: string, scholarshipId: string, documentName: string) {
  const deleted = await db.delete(documentFiles)
    .where(and(eq(documentFiles.userId, userId), eq(documentFiles.scholarshipId, scholarshipId), eq(documentFiles.documentName, documentName)))
    .returning({ name: documentFiles.documentName });
  if (deleted.length === 0) throw notFound();
}

/** Metadados (sem o conteúdo) dos arquivos de várias candidaturas do estudante. */
export async function listFileMeta(db: Database, userId: string) {
  const rows = await db
    .select({ scholarshipId: documentFiles.scholarshipId, documentName: documentFiles.documentName, fileName: documentFiles.fileName, size: documentFiles.size, contentType: documentFiles.contentType, uploadedAt: documentFiles.uploadedAt })
    .from(documentFiles).where(eq(documentFiles.userId, userId));
  return rows.map((r) => ({ scholarshipId: r.scholarshipId, documentName: r.documentName, file: toMeta(r) }));
}
