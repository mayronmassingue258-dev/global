// As variáveis NEXT_PUBLIC_* devem ser lidas literalmente para o Next.js inlinhá-las no build.
/**
 * Base da API vista pelo NAVEGADOR. Recomendado: "/api" — o próprio site repassa para o backend (next.config.ts),
 * então o cookie de sessão é do domínio do site (primeira parte), compatível com todos os navegadores.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Endereço do backend visto pelo SERVIDOR do Next (sem /api no fim), ex.: https://globalscholar-api-demo.onrender.com.
 * Usado no repasse /api/* e nas chamadas feitas durante a renderização no servidor. Não vai para o navegador.
 */
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL?.replace(/\/$/, "");

/** Base usada nas chamadas feitas no servidor: a URL interna, se houver; senão a pública (quando for absoluta). */
export const SERVER_API_BASE_URL = API_INTERNAL_URL ? `${API_INTERNAL_URL}/api` : API_BASE_URL;

/** Modo de dados explícito. Qualquer valor diferente de "mock" usa a API real (padrão de produção). */
export const DATA_MODE: "mock" | "api" = process.env.NEXT_PUBLIC_DATA_MODE === "mock" ? "mock" : "api";

export const IS_MOCK_MODE = DATA_MODE === "mock";

/**
 * Envio de arquivos. DESLIGADO até o backend definir o armazenamento (docs/api-contract.md, seção "Arquivos").
 * Desligado, a interface valida o arquivo mas não o envia.
 */
export const UPLOADS_ENABLED = process.env.NEXT_PUBLIC_UPLOADS_ENABLED === "true";
