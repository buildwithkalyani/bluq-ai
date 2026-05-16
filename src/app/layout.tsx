import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "BluQ - Construction Schedule Intelligence",
  description: "Turn your WhatsApp & site chats into a real-time audit trail. No process change for your team. Built for construction.",
  openGraph: {
    title: "BluQ - Construction Schedule Intelligence",
    description: "Turn your WhatsApp & site chats into a real-time audit trail. No process change for your team. Built for construction.",
    url: "https://bluq.ai",
    siteName: "BluQ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BluQ - Construction Schedule Intelligence",
    description: "Turn your WhatsApp & site chats into a real-time audit trail. No process change for your team. Built for construction.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}