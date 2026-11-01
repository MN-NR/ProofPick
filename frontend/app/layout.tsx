import type { Metadata } from "next";
import { DM_Mono, DM_Sans, Fraunces } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const body = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--font-body" });
const serif = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-serif", style: ["normal", "italic"], axes: ["opsz", "SOFT"] });
const label = DM_Mono({ subsets: ["latin"], display: "swap", variable: "--font-label", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "ProofPick",
  description: "Find it. Check it. Try it on. Clothing recommendations that come with evidence.",
};

const MOTTO = ["Find it.", "Check it.", "Try it on."];

function Ribbon() {
  const run = (
    <div className="flex flex-none items-center gap-10 pr-10">
      {[0, 1, 2].flatMap((n) => MOTTO.map((m) => (
        <span key={`${n}${m}`} className="flex items-center gap-10 whitespace-nowrap">
          {m}<span className="size-1.5 rotate-45 bg-gold" />
        </span>
      )))}
    </div>
  );
  return (
    <div aria-hidden="true" className="overflow-hidden border-y border-dashed border-card/30 py-4">
      <div className="flex w-max animate-ribbon font-display text-3xl italic text-card/90 sm:text-4xl">{run}{run}</div>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${serif.variable} ${label.variable}`}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <header className="sticky top-0 z-10 border-b border-dashed border-brand/25 bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="group rounded-[3px]">
              <span className="stitch-light inline-block rounded-[3px] bg-brand px-4 py-1.5 font-display text-xl font-semibold tracking-tight text-card shadow-brand transition duration-300 group-hover:-rotate-2">
                ProofPick
              </span>
            </Link>
            <p className="hidden items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted sm:flex">
              {MOTTO.map((m, i) => (
                <span key={m} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden="true" className="size-1 rotate-45 bg-gold" />}
                  <span className={i === MOTTO.length - 1 ? "text-brand" : ""}>{m}</span>
                </span>
              ))}
            </p>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="mt-20 bg-brand text-card">
          <Ribbon />
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 font-mono text-[11px] uppercase tracking-[0.16em] text-card/80 sm:px-6">
            <p><span className="font-display text-base normal-case tracking-normal text-card">ProofPick</span> · Clothing recommendations that come with evidence.</p>
            <p>{MOTTO.join(" ")}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
