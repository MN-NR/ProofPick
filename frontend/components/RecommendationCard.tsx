"use client";

import { Card, Check, Preview, requirementLabel } from "@/lib/api";
import { Button, CheckPill, ErrorNote, PreviewPill } from "./ui";

export function CheckRows({ checks, onOpen }: { checks: Check[]; onOpen: (check: Check) => void }) {
  return (
    <ul className="divide-y divide-line">
      {checks.map((check) => (
        <li key={check.requirement}>
          <button onClick={() => onOpen(check)} className="flex w-full items-start justify-between gap-3 py-2 text-left text-sm hover:bg-paper">
            <span>
              <span className="font-medium">{requirementLabel(check.requirement)}: </span>
              <span className="text-muted">{check.explanation}</span>
            </span>
            <CheckPill status={check.status} />
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
    && latest.inspection?.status !== "no_visible_mismatch_detected";
  return (
    <div className="space-y-2">
      {inProgress && <p className="rounded-md bg-paper p-3 text-sm" role="status">{latest.status === "inspecting" ? "Inspecting your preview…" : "Creating your preview…"}</p>}
      {latest.status === "failed" && <ErrorNote>{latest.error ?? "This preview could not be created."}</ErrorNote>}
      {latest.status === "skipped" && <p className="rounded-md bg-warn-bg p-3 text-sm text-warn">{latest.error}</p>}
      {shown?.image_url && (
        <button onClick={() => onOpen(shown)} className="block w-full text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown.image_url} alt={`Try-on preview of ${card.name}`} className="aspect-[3/4] w-full rounded-md border border-line object-cover" />
        </button>
      )}
      {shown?.inspection && (
        <div className="space-y-1">
          <PreviewPill status={shown.inspection.status} />
          <p className="text-sm text-muted">{shown.inspection.summary}</p>
          <button onClick={() => onOpen(shown)} className="text-sm font-medium text-brand underline">Compare with the original</button>
        </div>
      )}
      {canRetry && <Button variant="quiet" disabled={retrying} onClick={onRetry}>{retrying ? "Requesting…" : "Retry this preview (one per session)"}</Button>}
    </div>
  );
}

export function RecommendationCard({ card, rank, hasPhoto, retriesRemaining, retrying, onRetry, onOpenCheck, onOpenPreview }: {
  card: Card; rank: number; hasPhoto: boolean; retriesRemaining: number; retrying: boolean;
  onRetry: () => void; onOpenCheck: (check: Check) => void; onOpenPreview: (preview: Preview) => void;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-line bg-card">
      <div className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Pick {rank} · {card.brand}</p>
        <h3 className="font-display text-xl font-bold">{card.name} — ${card.price.toFixed(2)}</h3>
        <p className="text-sm text-muted">{card.variant}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={card.image_url} alt={`Original ${card.name}`} className="aspect-square w-full border-y border-line object-contain" />
      <section className="p-4">
        <h4 className="text-sm font-semibold text-ok">Meets your documented product requirements</h4>
        <CheckRows checks={card.checks} onOpen={onOpenCheck} />
        {card.explanation && <p className="mt-2 text-sm"><span className="font-medium">Why this order: </span>{card.explanation}</p>}
      </section>
      <section className="mt-auto border-t border-line bg-paper/50 p-4">
        <h4 className="mb-2 text-sm font-semibold">Try-on preview</h4>
        <PreviewBlock card={card} hasPhoto={hasPhoto} retriesRemaining={retriesRemaining} retrying={retrying} onRetry={onRetry} onOpen={onOpenPreview} />
        <p className="mt-3 text-xs text-muted">Physical fit has not been assessed.</p>
      </section>
      <p className="border-t border-line px-4 py-2 text-xs text-muted">{card.data_label}. Collected {card.collected_at}.</p>
    </article>
  );
}
