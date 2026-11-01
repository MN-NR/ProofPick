"use client";

import { Card, Check, Preview, requirementLabel } from "@/lib/api";
import { Button, CheckPill, ErrorNote, IconCamera, IconCheck, Notice, PreviewPill, Seal, Spinner } from "./ui";

/** Requirement checks set like a receipt: label, dotted leader, verdict, then the reason. */
export function CheckRows({ checks, onOpen }: { checks: Check[]; onOpen: (check: Check) => void }) {
  return (
    <ul className="divide-y divide-dashed divide-line">
      {checks.map((check) => (
        <li key={check.requirement}>
          <button onClick={() => onOpen(check)} className="-mx-2 block w-[calc(100%+1rem)] rounded-md px-2 py-2.5 text-left transition hover:bg-brand-soft/55">
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">{requirementLabel(check.requirement)}: </span>
              <span aria-hidden="true" className="mt-2 min-w-4 flex-1 border-b-2 border-dotted border-line-strong" />
              <CheckPill status={check.status} />
            </span>
            <span className="mt-0.5 block text-sm leading-snug text-muted">{check.explanation}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PreviewBlock({ card, hasPhoto, retriesRemaining, retrying, onRetry, onOpen }: {
  card: Card; hasPhoto: boolean; retriesRemaining: number; retrying: boolean;
  onRetry: () => void; onOpen: (preview: Preview) => void;
}) {
  if (!hasPhoto) return <p className="text-sm text-muted">Add a photo to a new search to see a try-on preview.</p>;
  const latest = card.previews.at(-1);
  if (!latest) return <p className="text-sm text-muted">No preview requested.</p>;
  const shown = latest.image_url ? latest : card.previews.findLast((p) => p.image_url);
  const inProgress = ["pending", "running", "inspecting"].includes(latest.status);
  const canRetry = retriesRemaining > 0 && !inProgress && latest.status !== "skipped"
    && latest.inspection?.status !== "no_visible_mismatch_detected" && latest.inspection?.method !== "unavailable";
  return (
    <div className="space-y-3">
      {inProgress && (
        <p className="flex items-center gap-2.5 rounded-md bg-card px-3.5 py-3 text-sm text-ink ring-1 ring-line" role="status">
          <Spinner className="size-4 text-brand" />{latest.status === "inspecting" ? "Inspecting your preview…" : "Creating your preview…"}
        </p>
      )}
      {latest.status === "failed" && <ErrorNote>{latest.error ?? "This preview could not be created."}</ErrorNote>}
      {latest.status === "skipped" && <Notice tone="warn">{latest.error}</Notice>}
      {shown?.image_url && (
        <button onClick={() => onOpen(shown)} className="group/preview block w-full rotate-[-1deg] bg-card p-2 pb-3 text-left shadow-card ring-1 ring-line transition duration-300 hover:rotate-0 hover:ring-brand/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown.image_url} alt={`Try-on preview of ${card.name}`} className="aspect-[3/4] w-full object-cover" />
        </button>
      )}
      {shown?.inspection && (
        <div className="space-y-1.5">
          <PreviewPill status={shown.inspection.status} />
          <p className="text-sm text-muted">{shown.inspection.summary}</p>
          <button onClick={() => onOpen(shown)} className="text-sm font-medium text-brand underline decoration-brand/30 underline-offset-4 transition hover:decoration-brand">Compare with the original</button>
        </div>
      )}
      {canRetry && <Button variant="quiet" disabled={retrying} onClick={onRetry}>{retrying ? <><Spinner />Requesting…</> : "Retry this preview (one per session)"}</Button>}
    </div>
  );
}

export const TAG_SHAPE ="[clip-path:polygon(30px_0,calc(100%_-_30px)_0,100%_30px,100%_100%,0_100%,0_30px)]";

export function RecommendationCard({ card, rank, hasPhoto, retriesRemaining, retrying, onRetry, onOpenCheck, onOpenPreview }: {
  card: Card; rank: number; hasPhoto: boolean; retriesRemaining: number; retrying: boolean;
  onRetry: () => void; onOpenCheck: (check: Check) => void; onOpenPreview: (preview: Preview) => void;
}) {
  return (
    <div className="group relative h-full origin-top pt-8 drop-shadow-[0_14px_20px_rgb(74_32_36/0.16)] transition duration-500 hover:-translate-y-1 hover:-rotate-[0.6deg]">
      <article className={`flex h-full flex-col bg-card ${TAG_SHAPE}`}>
        <div className="relative px-6 pb-5 pt-11 text-center">
          <span aria-hidden="true" className="absolute left-1/2 top-4 size-4 -translate-x-1/2 rounded-full bg-paper shadow-[inset_0_1px_3px_rgb(42_22_25/0.35)] ring-[3px] ring-gold/70" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">Pick {rank} · {card.brand}</p>
          <h3 className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight text-ink">{card.name}</h3>
          <p className="mt-1 text-sm text-muted">{card.variant}</p>
        </div>
        <div className="relative mx-5">
          <div className="stitch overflow-hidden rounded-sm bg-linear-to-b from-sand to-paper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.image_url} alt={`Original ${card.name}`} className="aspect-[4/5] w-full object-contain p-7 transition duration-500 group-hover:scale-[1.04]" />
          </div>
          <Seal className="absolute -right-2 -top-4 -rotate-12">{rank}</Seal>
        </div>
        <div className="relative mx-0 mb-3 mt-8 border-t-2 border-dashed border-line">
          <span aria-hidden="true" className="absolute -left-2.5 -top-[11px] size-5 rounded-full bg-paper" />
          <span aria-hidden="true" className="absolute -right-2.5 -top-[11px] size-5 rounded-full bg-paper" />
          <p className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-card px-3 font-display text-3xl font-semibold tabular-nums text-brand">${card.price.toFixed(2)}</p>
        </div>
        <section className="px-6 pb-5 pt-4">
          <h4 className="mb-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ok"><IconCheck className="size-3.5" />Meets your documented product requirements</h4>
          <CheckRows checks={card.checks} onOpen={onOpenCheck} />
          {card.explanation && (
            <p className="mt-3 border-l-2 border-gold bg-paper/70 px-3.5 py-2.5 text-sm text-ink"><span className="font-medium">Why this order: </span>{card.explanation}</p>
          )}
        </section>
        <section className="mt-auto border-t-2 border-dashed border-line bg-sand/45 px-6 py-5">
          <h4 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-brand"><IconCamera className="size-3.5" />Try-on preview</h4>
          <PreviewBlock card={card} hasPhoto={hasPhoto} retriesRemaining={retriesRemaining} retrying={retrying} onRetry={onRetry} onOpen={onOpenPreview} />
          <p className="mt-3 text-xs text-muted">Physical fit has not been assessed.</p>
        </section>
        <p className="border-t border-line bg-sand/45 px-6 py-3 font-mono text-[10.5px] leading-relaxed text-muted">{card.data_label}. Collected {card.collected_at}.</p>
      </article>
      <svg aria-hidden="true" viewBox="0 0 80 58" className="pointer-events-none absolute left-1/2 top-0 z-[1] h-[58px] w-20 -translate-x-1/2 text-gold">
        <path d="M40 54C40 38 21 32 25 18 28 8 46 6 54 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
