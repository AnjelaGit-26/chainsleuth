import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chainsleuth — Cybercrime Asset Investigation Workspace",
  description:
    "Multi-hop blockchain asset traversal, Section 94 BNSS legal freeze directives, and NCRP intelligence correlation platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500&family=Manrope:wght@400;500;600;700&family=Sora:wght@600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
