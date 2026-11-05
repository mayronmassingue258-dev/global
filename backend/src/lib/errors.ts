/** Erro com o envelope do contrato: { error: { code, message, fields? } } (docs/api-contract.md, seção 2). */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    readonly fields?: Record<string, string>
  ) {
    super(code);
  }
}

export const notFound = () => new HttpError(404, "not_found");
export const validationFailed = (fields: Record<string, string>) => new HttpError(422, "validation_failed", fields);

export function errorBody(code: string, fields?: Record<string, string>) {
  return { error: { code, message: code, ...(fields && Object.keys(fields).length > 0 ? { fields } : {}) } };
}
