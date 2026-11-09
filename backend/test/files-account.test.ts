import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { cleanFileName, detectFileType } from "../src/services/files.js";
import { setupTestApp } from "./helpers.js";

let t: Awaited<ReturnType<typeof setupTestApp>>;
beforeAll(async () => { t = await setupTestApp(); });
afterAll(async () => { await t.close(); });

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(2000, 0x20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
const EXE_AS_PDF = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100)]);

/** Monta um corpo multipart/form-data com o campo `file`. */
function multipart(field: string, filename: string, content: Buffer, type = "application/octet-stream") {
  const boundary = "----gs-test-boundary";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function upload(cookie: string, appId: string, doc: string, filename: string, content: Buffer, field = "file") {
  const { body, contentType } = multipart(field, filename, content);
  const res = await t.app.inject({
    method: "PUT",
    url: `/api/applications/${encodeURIComponent(appId)}/documents/${encodeURIComponent(doc)}/file`,
    headers: { cookie, "content-type": contentType },
    payload: body
  });
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : undefined };
}

describe("tipo de arquivo pelo conteúdo", () => {
  it("reconhece PDF, PNG, JPG e DOCX; recusa o resto", () => {
    expect(detectFileType(PDF)).toBe("application/pdf");
    expect(detectFileType(PNG)).toBe("image/png");
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("....word/document.xml....")]);
    expect(detectFileType(docx)).toMatch(/wordprocessingml/);
    expect(detectFileType(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("um zip qualquer")]))).toBeNull();
    expect(detectFileType(EXE_AS_PDF)).toBeNull();
  });

  it("limpa nomes de arquivo perigosos", () => {
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("C:\\Users\\ana\\diploma.pdf")).toBe("diploma.pdf");
    expect(cleanFileName('a"b\u0000c.pdf')).toBe("abc.pdf");
    expect(cleanFileName("   ")).toBe("arquivo");
  });
});

describe("anexos do checklist", () => {
  let ana: string;
  beforeEach(async () => {
    await t.reset();
    ana = await t.signUp("ana@exemplo.com");
    await t.call("/applications", { method: "POST", body: { scholarshipId: "amostra-001" }, cookie: ana });
  });

  it("envia, aparece na candidatura (sem o conteúdo), baixa idêntico, substitui e remove", async () => {
    const up = await upload(ana, "amostra-001", "Diploma", "meu diploma.pdf", PDF);
    expect(up.status).toBe(200);
    expect(up.json).toMatchObject({ name: "meu diploma.pdf", size: PDF.length, type: "application/pdf" });

    const app = (await t.call("/applications/amostra-001", { cookie: ana })).json;
    expect(app.documents[0]).toMatchObject({ name: "Diploma", done: false, file: { name: "meu diploma.pdf", size: PDF.length } });
    expect(app.documents[1]).not.toHaveProperty("file");

    const download = await t.app.inject({ method: "GET", url: "/api/applications/amostra-001/documents/Diploma/file", headers: { cookie: ana } });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-type"]).toBe("application/pdf");
    expect(download.headers["content-disposition"]).toBe("attachment; filename*=UTF-8''meu%20diploma.pdf");
    expect(download.headers["content-security-policy"]).toContain("sandbox");
    expect(download.rawPayload.equals(PDF)).toBe(true);

    expect((await upload(ana, "amostra-001", "Diploma", "foto.png", PNG)).json).toMatchObject({ type: "image/png" });
    expect((await t.call("/applications/amostra-001", { cookie: ana })).json.documents[0].file.name).toBe("foto.png");

    expect((await t.call("/applications/amostra-001/documents/Diploma/file", { method: "DELETE", cookie: ana })).status).toBe(204);
    expect((await t.call("/applications/amostra-001/documents/Diploma/file", { cookie: ana })).status).toBe(404);
  });

  it("recusa tipo falso, arquivo vazio, campo errado e item inexistente", async () => {
    const fake = await upload(ana, "amostra-001", "Diploma", "virus.pdf", EXE_AS_PDF);
    expect(fake.status).toBe(422);
    expect(fake.json.error.fields).toEqual({ file: "invalid_type" });
    expect((await upload(ana, "amostra-001", "Diploma", "vazio.pdf", Buffer.alloc(0))).json.error.fields).toEqual({ file: "empty" });
    expect((await upload(ana, "amostra-001", "Diploma", "a.pdf", PDF, "outro")).json.error.fields).toEqual({ file: "required" });
    expect((await upload(ana, "amostra-001", "Não existe", "a.pdf", PDF)).status).toBe(404);
    expect((await upload(ana, "amostra-999", "Diploma", "a.pdf", PDF)).status).toBe(404);
  });

  it("acima de 10 MB → 413", async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
    expect((await upload(ana, "amostra-001", "Diploma", "grande.pdf", big)).status).toBe(413);
  });

  it("outro estudante não envia, não baixa e não apaga os arquivos da Ana", async () => {
    await upload(ana, "amostra-001", "Diploma", "d.pdf", PDF);
    const bia = await t.signUp("bia@exemplo.com");
    expect((await t.call("/applications/amostra-001/documents/Diploma/file", { cookie: bia })).status).toBe(404);
    expect((await t.call("/applications/amostra-001/documents/Diploma/file", { method: "DELETE", cookie: bia })).status).toBe(404);
    expect((await upload(bia, "amostra-001", "Diploma", "x.pdf", PDF)).status).toBe(404);
    expect((await t.call("/applications/amostra-001/documents/Diploma/file", { cookie: null })).status).toBe(401);
  });

  it("remover a candidatura apaga os arquivos dela", async () => {
    await upload(ana, "amostra-001", "Diploma", "d.pdf", PDF);
    await t.call("/applications/amostra-001", { method: "DELETE", cookie: ana });
    const [{ n }] = (await t.db.execute(sql`select count(*)::int as n from document_files`)) as unknown as [{ n: number }];
    expect(n).toBe(0);
  });
});

describe("conta: exportar e excluir", () => {
  beforeEach(async () => { await t.reset(); });

  it("exporta tudo do estudante num JSON para download", async () => {
    const ana = await t.signUp("ana@exemplo.com");
    await t.call("/profile", { method: "PUT", body: { residence: "Angola", level: "Mestrado" }, cookie: ana });
    await t.call("/applications", { method: "POST", body: { scholarshipId: "amostra-001" }, cookie: ana });
    await t.call("/drafts", { method: "POST", body: { type: "academic_cv", title: "CV", sections: { education: "UEM" } }, cookie: ana });
    await upload(ana, "amostra-001", "Diploma", "d.pdf", PDF);

    const res = await t.app.inject({ method: "GET", url: "/api/auth/me/export", headers: { cookie: ana } });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="globalscholar-meus-dados-\d{4}-\d{2}-\d{2}\.json"$/);
    const data = JSON.parse(res.body);
    expect(data.account).toMatchObject({ email: "ana@exemplo.com", name: "Ana" });
    expect(data.account).not.toHaveProperty("passwordHash");
    expect(data.profile.residence).toBe("Angola");
    expect(data.applications[0].documents[0].file.name).toBe("d.pdf");
    expect(data.drafts[0].sections).toEqual({ education: "UEM" });
    expect(JSON.stringify(data)).not.toContain("scrypt$");
    expect((await t.call("/auth/me/export", { cookie: null })).status).toBe(401);
  });

  it("excluir exige a senha e apaga a conta e todos os dados dela", async () => {
    const ana = await t.signUp("ana@exemplo.com", "senha-segura-1");
    const bia = await t.signUp("bia@exemplo.com");
    await t.call("/applications", { method: "POST", body: { scholarshipId: "amostra-001" }, cookie: ana });
    await t.call("/applications", { method: "POST", body: { scholarshipId: "amostra-001" }, cookie: bia });
    await upload(ana, "amostra-001", "Diploma", "d.pdf", PDF);

    expect((await t.call("/auth/me", { method: "DELETE", body: {}, cookie: ana })).json.error.fields).toEqual({ password: "required" });
    expect((await t.call("/auth/me", { method: "DELETE", body: { password: "errada" }, cookie: ana })).json.error.fields).toEqual({ password: "incorrect" });

    const res = await t.call("/auth/me", { method: "DELETE", body: { password: "senha-segura-1" }, cookie: ana });
    expect(res.status).toBe(204);
    expect(res.sessionCookie).toBe("");
    expect((await t.call("/auth/me", { cookie: ana })).status).toBe(401);
    expect((await t.call("/auth/login", { method: "POST", body: { email: "ana@exemplo.com", password: "senha-segura-1" }, cookie: null })).status).toBe(401);

    const count = async (table: string) => ((await t.db.execute(sql.raw(`select count(*)::int as n from ${table}`))) as unknown as [{ n: number }])[0].n;
    expect(await count("users")).toBe(1);
    expect(await count("applications")).toBe(1); // só a da Bia
    expect(await count("document_files")).toBe(0);
    expect((await t.call("/applications", { cookie: bia })).json.items).toHaveLength(1);
  });
});
