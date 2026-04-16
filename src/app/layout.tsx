import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BluQ",
  description: "Construction schedule intelligence",
  openGraph: {
    title: "BluQ",
    description: "Construction schedule intelligence",
    url: "https://bluq.ai",
    siteName: "BluQ",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "BluQ",
    description: "Construction schedule intelligence",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}