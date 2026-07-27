import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Importer",
  description: "El. pašto lead'ų importas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt">
      <body>{children}</body>
    </html>
  );
}
