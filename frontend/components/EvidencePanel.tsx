"use client";

import { useEffect } from "react";
import { Card, Check, METHOD_LABELS, Preview, requirementLabel } from "@/lib/api";
import { Button, CheckPill, PreviewPill } from "./ui";

export type PanelContent =
  | { type: "check"; card: Card; check: Check }
  | { type: "preview"; card: Card; preview: Preview };

const FEATURE_TEXT = { consistent: "Appears consistent", altered: "Appears different", hidden: "Hidden in the preview", unclear: "Too unclear to compare" };

function CheckDetail({ check }: { check: Check }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><h3 className="font-semibold">{requirementLabel(check.requirement)}</h3><CheckPill status={check.status} /></div>
      <p>{check.explanation}</p>
      <dl className="space-y-2 text-sm">
        <div><dt className="font-medium">Observed</dt><dd className="text-muted">{check.observed}</dd></div>
        <div><dt className="font-medium">How this was checked</dt><dd className="text-muted">{METHOD_LABELS[check.method] ?? check.method}</dd></div>
      </dl>
      <div>
        <h4 className="text-sm font-medium">Source evidence</h4>
        {check.evidence.length === 0 && <p className="mt-1 text-sm text-muted">No source contained this information.</p>}
        <ul className="mt-2 space-y-3">
          {check.evidence.map((e) => (
            <li key={e.id} className="rounded-md border border-line bg-white p-3 text-sm">
              {e.quote && <blockquote className="font-display text-base">“{e.quote}”</blockquote>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {e.image_url && <img src={e.image_url} alt="Original product" className="max-h-64 rounded" />}
              <p className="mt-2 text-xs text-muted">{e.source} · collected {e.collected_at}</p>
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.image_url} alt={`Original ${card.name}`} className="w-full rounded-md border border-line" />
          <figcaption className="mt-1 text-xs text-muted">Original garment</figcaption>
        </figure>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview.image_url && <img src={preview.image_url} alt={`Try-on preview of ${card.name}`} className="w-full rounded-md border border-line" />}
          <figcaption className="mt-1 text-xs text-muted">YouCam preview</figcaption>
        </figure>
      </div>
      {inspection && (
        <>
          <PreviewPill status={inspection.status} />
          {inspection.features.length === 0 && <p className="text-sm">{inspection.summary}</p>}
          <ul className="space-y-2 text-sm">
            {inspection.features.map((f) => (
              <li key={f.feature} className="rounded-md border border-line bg-white p-3">
                <p className="font-medium capitalize">{f.feature}: {FEATURE_TEXT[f.status]}</p>
                <p className="text-muted">{f.observation}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-muted">
        This is an AI-assisted visual assessment, not a guarantee. It does not cover physical fit, comfort, opacity or exact color,
        and it does not change whether the product meets your requirements.
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
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Evidence" onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-lg overflow-y-auto bg-paper p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{content.type === "check" ? "Product evidence" : "Preview inspection"}</p>
            <h2 className="font-display text-xl font-bold">{content.card.name}</h2>
          </div>
          <Button variant="quiet" onClick={onClose} autoFocus>Close</Button>
        </div>
        {content.type === "check" ? <CheckDetail check={content.check} /> : <PreviewDetail card={content.card} preview={content.preview} />}
      </aside>
    </div>
  );
}
