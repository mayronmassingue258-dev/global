import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os testes de ponta a ponta usam uma pasta de build separada para não misturar com `npm run build`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Formatos modernos: o navegador recebe AVIF ou WebP quando suporta (JPG continua como fonte).
  images: { formats: ["image/avif", "image/webp"] }
};

export default nextConfig;
