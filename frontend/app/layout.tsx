import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "ChainSleuth — Crypto Fraud Investigation Console",
  description:
    "Multi-chain automated asset tracing, VASP deposit attribution, and BNSS Section 94 legal freeze notice generator for law enforcement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100 selection:bg-teal-900 selection:text-teal-200">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
