// As variáveis NEXT_PUBLIC_* devem ser lidas literalmente para o Next.js inlinhá-las no build.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/** Modo de dados explícito. Qualquer valor diferente de "mock" usa a API real (padrão de produção). */
export const DATA_MODE: "mock" | "api" = process.env.NEXT_PUBLIC_DATA_MODE === "mock" ? "mock" : "api";

export const IS_MOCK_MODE = DATA_MODE === "mock";
