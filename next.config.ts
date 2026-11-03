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
