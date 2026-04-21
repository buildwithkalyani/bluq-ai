import type { Metadata } from "next";
import "./marketing.css";

export const metadata: Metadata = {
  title: "BluQ — the real-time audit layer for construction",
  description: "BluQ auto-builds your schedule from drawings and BOQ, flags slippage the hour it happens, and keeps the evidence trail that wins penalty disputes.",
  openGraph: {
    title: "BluQ — the real-time audit layer for construction",
    description: "BluQ auto-builds your schedule from drawings and BOQ, flags slippage the hour it happens, and keeps the evidence trail that wins penalty disputes.",
    url: "https://bluq.ai",
    siteName: "BluQ",
    type: "website",
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="m-root">{children}</div>;
}
