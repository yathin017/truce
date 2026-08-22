import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reservoir — gas-aware keeper coordination for Monad",
  description:
    "On Monad you pay the gas limit you declare, so losing a keeper race costs as much as winning. Reservoir moves the race onto a cheap reservation. Watch the savings live.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
