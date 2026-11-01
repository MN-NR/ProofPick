import type { PreviewStatus, ProductStatus } from "@/lib/api";

const TONES = {
  ok: "bg-ok-bg text-ok",
  bad: "bg-bad-bg text-bad",
  warn: "bg-warn-bg text-warn",
};

export function Pill({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function CheckPill({ status }: { status: ProductStatus }) {
  if (status === "meets_documented_requirements") return <Pill tone="ok">Supported</Pill>;
  if (status === "conflicts_with_requirement") return <Pill tone="bad">Conflict</Pill>;
  return <Pill tone="warn">Unknown</Pill>;
}

export function PreviewPill({ status }: { status: PreviewStatus }) {
  if (status === "no_visible_mismatch_detected") return <Pill tone="ok">No visible mismatch detected</Pill>;
  if (status === "possible_mismatch") return <Pill tone="bad">Possible mismatch</Pill>;
  return <Pill tone="warn">Could not be checked</Pill>;
}

export function Button({ variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" }) {
  const look = variant === "primary"
    ? "bg-brand text-white hover:opacity-90"
    : "border border-line bg-card text-ink hover:border-muted";
  return <button className={`rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`} {...props} />;
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">{children}</p>;
}
