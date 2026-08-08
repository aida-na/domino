import type { Metadata, Viewport } from "next";
import { Figtree, Newsreader, JetBrains_Mono } from "next/font/google";
import { DominoAuthProvider } from "@/features/domino/domino-auth-context";
import { DominoThemeProvider } from "@/features/domino/domino-theme";
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
  title: "domino — save now, find later",
  description: "Save links, notes, and ideas via iMessage. Get a weekly digest of your own brilliance.",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('domino_theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.dataset.theme='dark';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${figtree.variable} ${newsreader.variable} ${jetbrainsMono.variable} antialiased`} style={{ fontFamily: 'var(--font-figtree, ui-sans-serif, sans-serif)' }}>
        <DominoThemeProvider>
          <DominoAuthProvider>
            {children}
          </DominoAuthProvider>
        </DominoThemeProvider>
      </body>
    </html>
  );
}
