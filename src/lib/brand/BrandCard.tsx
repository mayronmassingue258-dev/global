/**
 * Arte da imagem de compartilhamento (Open Graph / Twitter), desenhada com ImageResponse.
 * Marca PROVISÓRIA: só o nome de trabalho em tipografia, sem logo inventado.
 */
export const OG_SIZE = { width: 1200, height: 630 };

export function BrandCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#080808", color: "#ffffff", fontFamily: "serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 30, letterSpacing: -0.5 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: "#ffffff", color: "#080808", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>G</div>
        GlobalScholar
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 76, lineHeight: 1.05, maxWidth: 900 }}>{title}</div>
        <div style={{ fontSize: 30, color: "#c8c8c3", fontFamily: "sans-serif" }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", height: 2, width: 120, background: "#ffffff" }} />
    </div>
  );
}
