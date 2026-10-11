import type { Metadata, Viewport } from "next";
import { Archivo_Narrow, VT323 } from "next/font/google";
import "./globals.css";

const ui = Archivo_Narrow({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-ui" });
const mono = VT323({ weight: "400", subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Moodtube",
  description: "A personal YouTube subscription feed.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#d6d4cd",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
