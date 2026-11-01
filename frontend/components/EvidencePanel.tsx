"use client";

import { useEffect } from "react";
import { Card, Check, METHOD_LABELS, Preview, requirementLabel } from "@/lib/api";
import { Button, CheckPill, IconCheck, IconInfo, IconQuestion, IconX, PreviewPill } from "./ui";

export type PanelContent =
  | { type: "check"; card: Card; check: Check }
  | { type: "preview"; card: Card; preview: Preview };

const FEATURE_TEXT = { consistent: "Appears consistent", altered: "Appears different", hidden: "Hidden in the preview", unclear: "Too unclear to compare" };
const FEATURE_LOOK = {
  consistent: { tone: "bg-ok-bg text-ok", Icon: IconCheck },
  altered: { tone: "bg-bad-bg text-bad", Icon: IconX },
  hidden: { tone: "bg-warn-bg text-warn", Icon: IconQuestion },
  unclear: { tone: "bg-warn-bg text-warn", Icon: IconQuestion },
};

function Rule({ children }: { children: React.ReactNode }) {
  return <h4 className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-brand">{children}<span aria-hidden="true" className="h-px flex-1 bg-brand/25" /></h4>;
}

function CheckDetail({ check }: { check: Check }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2.5"><h3 className="font-display text-2xl font-semibold text-ink">{requirementLabel(check.requirement)}</h3><CheckPill status={check.status} /></div>
      <p className="text-[15px] leading-relaxed text-ink">{check.explanation}</p>
      <dl className="grid gap-px overflow-hidden rounded-md border border-line bg-line text-sm">
        <div className="bg-card px-4 py-3"><dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">Observed</dt><dd className="mt-1 text-ink">{check.observed}</dd></div>
        <div className="bg-card px-4 py-3"><dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">How this was checked</dt><dd className="mt-1 text-ink">{METHOD_LABELS[check.method] ?? check.method}</dd></div>
      </dl>
      <div>
        <Rule>Source evidence</Rule>
        {check.evidence.length === 0 && <p className="mt-3 text-sm text-muted">No source contained this information.</p>}
        <ul className="mt-4 space-y-4">
          {check.evidence.map((e) => (
            <li key={e.id} className="stitch rounded-sm bg-card p-5 text-sm shadow-card">
              {e.quote && <blockquote className="border-l-2 border-brand pl-4 font-display text-lg italic leading-snug text-ink">“{e.quote}”</blockquote>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {e.image_url && <img src={e.image_url} alt="Original product" className="max-h-64 rounded-sm bg-linear-to-b from-sand to-paper p-2" />}
              <p className="mt-3 font-mono text-[10.5px] text-muted">{e.source} · collected {e.collected_at}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PreviewDetail({ card, preview }: { card: Card; preview: Preview }) {
  const inspection = preview.inspection;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 px-1 pt-1">
        <figure className="-rotate-1 bg-card p-2 pb-2.5 shadow-card ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.image_url} alt={`Original ${card.name}`} className="w-full bg-linear-to-b from-sand to-paper" />
          <figcaption className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Original garment</figcaption>
        </figure>
        <figure className="rotate-1 bg-card p-2 pb-2.5 shadow-card ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview.image_url && <img src={preview.image_url} alt={`Try-on preview of ${card.name}`} className="w-full bg-linear-to-b from-sand to-paper" />}
          <figcaption className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">YouCam preview</figcaption>
        </figure>
      </div>
      {inspection && (
        <>
          <PreviewPill status={inspection.status} />
          {inspection.features.length === 0 && <p className="text-sm text-ink">{inspection.summary}</p>}
          <ul className="space-y-2.5 text-sm">
            {inspection.features.map((f) => {
              const { tone, Icon } = FEATURE_LOOK[f.status];
              return (
                <li key={f.feature} className="flex gap-3 rounded-md border border-line bg-card p-3.5">
                  <span aria-hidden="true" className={`mt-0.5 grid size-6 flex-none place-items-center rounded-full ${tone}`}><Icon className="size-3.5" /></span>
                  <div className="min-w-0">
                    <p className="font-medium capitalize text-ink">{f.feature}: {FEATURE_TEXT[f.status]}</p>
                    <p className="text-muted">{f.observation}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="flex gap-2.5 border-t border-dashed border-line-strong pt-4 text-xs text-muted">
        <IconInfo className="mt-px size-3.5 flex-none" />
        <span>
          This is an AI-assisted visual assessment, not a guarantee. It does not cover physical fit, comfort, opacity or exact color,
          and it does not change whether the product meets your requirements.
        </span>
      </p>
    </div>
  );
}

export function EvidencePanel({ content, onClose }: { content: PanelContent | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!content) return null;
  return (
    <div className="fixed inset-0 z-20 flex animate-fade justify-end bg-ink/45 backdrop-blur-[3px]" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Evidence" onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-lg animate-sheet overflow-y-auto border-l-[5px] border-brand bg-paper shadow-lift">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-dashed border-brand/30 bg-paper/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">{content.type === "check" ? "Product evidence" : "Preview inspection"}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">{content.card.name}</h2>
          </div>
          <Button variant="quiet" onClick={onClose} autoFocus><IconX />Close</Button>
        </div>
        <div className="p-5 sm:p-6">
          {content.type === "check" ? <CheckDetail check={content.check} /> : <PreviewDetail card={content.card} preview={content.preview} />}
        </div>
      </aside>
    </div>
  );
}
