import type { Metadata } from "next";
import { Archivo, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/providers/WalletProvider";
import { ThemeProvider, themeScript } from "@/providers/ThemeProvider";
import { Rail } from "@/components/layout/Rail";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

/** Display face — the wordmark and nothing else. */
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["600", "900"],
});

export const metadata: Metadata = {
  title: "TRUCE — Coordinate first. Execute once.",
  description:
    "A coordination layer for competitive on-chain execution. One keeper holds the right to act; everyone else stands down.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${jetbrains.variable} ${unbounded.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <WalletProvider>
            <Rail />
            <main className="mx-auto max-w-[1560px]">{children}</main>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
