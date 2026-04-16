import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BluQ - Construction Schedule Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
          fontFamily: "sans-serif",
          padding: "60px",
        }}
      >
        {/* Logo */}
        <img
          src="https://bluq.ai/bluq-logo.png"
          width={320}
          height={120}
          style={{ objectFit: "contain", marginBottom: "40px" }}
        />

        {/* Headline */}
        <div
          style={{
            fontSize: "48px",
            fontWeight: "bold",
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: "24px",
          }}
        >
          Construction Schedule Intelligence
        </div>

        {/* Subtext */}
        <div
          style={{
            fontSize: "24px",
            color: "#bfdbfe",
            textAlign: "center",
            lineHeight: 1.4,
            marginBottom: "40px",
          }}
        >
          Turn your WhatsApp &amp; site chats into a real-time audit trail
        </div>

        {/* CTA */}
        <div
          style={{
            background: "#ffffff",
            color: "#1e3a5f",
            fontSize: "22px",
            fontWeight: "bold",
            padding: "16px 40px",
            borderRadius: "8px",
          }}
        >
          Get Early Access at bluq.ai
        </div>
      </div>
    ),
    { ...size }
  );
}
