import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", weight: ["400", "500"] });

const description = "Descubra bolsas de estudo, entenda os requisitos e organize suas candidaturas em um só lugar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: { default: "GlobalScholar — Plataforma global de bolsas", template: "%s · GlobalScholar" },
  description,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "pt_BR", description },
  twitter: { card: "summary_large_image" }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#080808" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <a className="skip-link" href="#main">Pular para o conteúdo</a>
        {children}
      </body>
    </html>
  );
}
