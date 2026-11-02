import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os testes de ponta a ponta usam uma pasta de build separada para não misturar com `npm run build`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false
};

export default nextConfig;
