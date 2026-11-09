import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SessionProvider } from "@/features/auth/SessionProvider";
import { getCurrentUser } from "@/lib/api/serverAuth";
import { getLocale, getT } from "@/i18n/server";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", weight: ["400", "500"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME,
    title: { default: t.meta.siteTitle, template: `%s · ${SITE_NAME}` },
    description: t.meta.siteDescription,
    openGraph: { type: "website", siteName: SITE_NAME, locale: t.meta.ogLocale, title: t.meta.siteTitle, description: t.meta.siteDescription },
    twitter: { card: "summary_large_image" }
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#080808" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, t, user] = await Promise.all([getLocale(), getT(), getCurrentUser()]);
  return (
    <html lang={t.meta.htmlLang} className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <I18nProvider locale={locale}>
          <SessionProvider user={user}>
            <a className="skip-link" href="#main">{t.common.skipLink}</a>
            {children}
          </SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
