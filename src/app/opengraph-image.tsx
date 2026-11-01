import { ImageResponse } from "next/og";

export const alt = "attnd – Events auf Koh Phangan & mehr";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "#000", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: "-0.05em", color: "#c6ff3d" }}>attnd</div>
        <div style={{ fontSize: 56, fontWeight: 700, marginTop: 20 }}>Dein Event. Deine Leute. Ein Ort.</div>
        <div style={{ fontSize: 32, marginTop: 24, color: "#bbb" }}>Events auf Koh Phangan & weltweit · www.attnd.space</div>
      </div>
    ),
    size,
  );
}
