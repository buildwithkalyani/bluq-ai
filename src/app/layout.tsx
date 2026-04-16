import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BluQ",
  description: "BluQ turns your existing WhatsApp and site chats into a real-time audit trail with no process change for your team. Construction schedule intelligence, simplified.",
  openGraph: {
    title: "BluQ",
    description: "BluQ turns your existing WhatsApp and site chats into a real-time audit trail with no process change for your team. Construction schedule intelligence, simplified.",
    url: "https://bluq.ai",
    siteName: "BluQ",
    type: "website",
    images: [
      {
        url: "https://bluq.ai/bluq-logo.png",
        width: 800,
        height: 600,
        alt: "BluQ Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BluQ",
    description: "BluQ turns your existing WhatsApp and site chats into a real-time audit trail with no process change for your team. Construction schedule intelligence, simplified.",
    images: ["https://bluq.ai/bluq-logo.png"],
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