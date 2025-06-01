import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/header";
import { ServerStatus } from "@/components/ui/server-status";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trust Token ETF Platform",
  description: "Decentralized ETF platform powered by Hedera",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50`}>
        <Header />
        <main className="min-h-screen px-4">
          {children}
        </main>
        <div className="fixed bottom-4 right-4 z-50 bg-white p-2 rounded-lg shadow-md">
          <ServerStatus />
        </div>
      </body>
    </html>
  );
}
