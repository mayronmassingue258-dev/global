import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícone da tela inicial (iOS). Monograma PROVISÓRIO. */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#080808", color: "#ffffff", fontSize: 120, fontFamily: "serif" }}>G</div>,
    size
  );
}
