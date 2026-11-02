import { SiteFooter } from "@/components/layout/SiteFooter";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
