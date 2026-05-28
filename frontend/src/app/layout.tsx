import type { Metadata, Viewport } from "next";
import { Figtree, Newsreader, JetBrains_Mono } from "next/font/google";
import { DominoAuthProvider } from "@/features/domino/domino-auth-context";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jb-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "domino — your second brain",
  description: "Save links, notes, and ideas via WhatsApp. Get a weekly digest of your own brilliance.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ED4715",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${figtree.variable} ${newsreader.variable} ${jetbrainsMono.variable} antialiased`} style={{ fontFamily: 'var(--font-figtree, ui-sans-serif, sans-serif)' }}>
        <DominoAuthProvider>
          {children}
        </DominoAuthProvider>
      </body>
    </html>
  );
}
