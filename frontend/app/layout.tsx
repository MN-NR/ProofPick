import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofPick",
  description: "Find it. Check it. Try it on. Clothing recommendations that come with evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-4 px-4 py-4">
            <Link href="/" className="font-display text-2xl font-bold text-brand">ProofPick</Link>
            <span className="text-sm text-muted">Find it. Check it. Try it on.</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
