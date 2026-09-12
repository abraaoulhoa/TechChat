import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TechChat — Comunicação Técnica",
  description:
    "Comunicação técnica, comunicados oficiais e guia de falhas da equipe de reparo.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
