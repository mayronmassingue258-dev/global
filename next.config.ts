import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/securityHeaders";

const nextConfig: NextConfig = {
  // Os testes de ponta a ponta usam uma pasta de build separada para não misturar com `npm run build`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Formatos modernos: o navegador recebe AVIF ou WebP quando suporta (JPG continua como fonte).
  images: { formats: ["image/avif", "image/webp"] },
  // Metadados (título, descrição, Open Graph) no <head> para TODOS os visitantes, não transmitidos depois.
  // Sem isso, o Next 15 coloca <meta name="description"> no fim do HTML para navegadores comuns, e robôs de
  // pré-visualização de links (WhatsApp, LinkedIn…) e o Lighthouse não o encontram.
  htmlLimitedBots: /.*/,
  // /api/* do site é repassado ao backend por src/app/api/[...path]/route.ts (com o IP de cada visitante).
  /**
   * Nomes dos arquivos de JavaScript SEM colchetes nem parênteses. Por padrão o Next usa o caminho da rota
   * ("app/(student)/scholarships/[id]/page-….js"); alguns proxies, CDNs e filtros de rede tratam esses caracteres
   * de forma diferente e devolvem 404, e a página da bolsa não carregava. Viram "_" (só no build de produção do navegador).
   */
  webpack(config, { isServer, dev }) {
    if (!isServer && !dev && config.output) {
      const original = config.output.filename;
      config.output.filename = (pathData: { chunk?: { name?: string | null } }) => {
        const name = pathData.chunk?.name;
        if (typeof name === "string" && /[[\]()]/.test(name)) return `static/chunks/${name.replace(/[[\]()]/g, "_")}-[contenthash].js`;
        return typeof original === "function" ? original(pathData) : original;
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ production: process.env.NODE_ENV === "production", apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL })
      }
    ];
  }
};

export default nextConfig;
