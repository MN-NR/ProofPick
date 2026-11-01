"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EvidencePanel, PanelContent } from "@/components/EvidencePanel";
import { CheckRows, RecommendationCard } from "@/components/RecommendationCard";
import { Button, ErrorNote } from "@/components/ui";
import { api, Card, requirementLabel, Run } from "@/lib/api";

const STAGE_TEXT: Record<string, string> = {
  queued: "Starting your search…",
  checking: "Checking product evidence…",
  ranking: "Ranking eligible products…",
  previewing: "Creating your previews…",
};

function CompactCard({ card, onOpen }: { card: Card; onOpen: (content: PanelContent) => void }) {
  const failing = card.checks.filter((c) => c.status !== "meets_documented_requirements");
  return (
    <article className="flex gap-3 rounded-lg border border-line bg-card p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={card.image_url} alt={`Original ${card.name}`} className="h-20 w-20 flex-none rounded object-contain" />
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold">{card.name} — ${card.price.toFixed(2)}</h4>
        <CheckRows checks={failing.length ? failing : card.checks} onOpen={(check) => onOpen({ type: "check", card, check })} />
      </div>
    </article>
  );
}

export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelContent | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRun(await api.run(id));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  const active = !run || !["complete", "failed"].includes(run.state);
  useEffect(() => {
    void load();
    if (!active) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [active, load]);

  async function retry(productId: string) {
    setRetrying(productId);
    setRetryError(null);
    try {
      await api.retry(id, productId);
      await load();
    } catch (e) {
      setRetryError((e as Error).message);
    } finally {
      setRetrying(null);
    }
  }

  async function deleteData() {
    if (!window.confirm("Delete this session's photos, previews and results from ProofPick?")) return;
    try {
      const { session_id } = await api.session();
      const { note } = await api.deleteSession(session_id);
      window.alert(`Deleted from ProofPick. ${note}`);
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const close = useCallback(() => setPanel(null), []);

  if (error && !run) {
    return <main className="mx-auto max-w-4xl px-4 py-8"><ErrorNote>{error}</ErrorNote><Link href="/" className="mt-4 inline-block underline">Start a new search</Link></main>;
  }
  if (!run) return <main className="mx-auto max-w-4xl px-4 py-8" role="status">Loading…</main>;

  const recommendations = run.recommendations ?? [];
  const usedRules = run.ranking_method === "rules" && recommendations.length > 1;
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Your results</h1>
            {run.original_text && <p className="mt-1 max-w-3xl text-muted">“{run.original_text}”</p>}
          </div>
          <div className="flex gap-2">
            <Link href="/" className="rounded-md border border-line bg-card px-4 py-2 text-sm font-semibold">Edit or start again</Link>
            <Button variant="quiet" onClick={deleteData}>Delete my data</Button>
          </div>
        </div>
        {active && <p role="status" className="mt-3 rounded-md bg-card p-3 text-sm">{STAGE_TEXT[run.state]}</p>}
        {run.state === "failed" && <div className="mt-3"><ErrorNote>{run.error}</ErrorNote></div>}
        {run.preview_notice && <p className="mt-3 rounded-md bg-warn-bg p-3 text-sm text-warn">{run.preview_notice}</p>}
        {retryError && <div className="mt-3"><ErrorNote>{retryError}</ErrorNote></div>}
        {usedRules && <p className="mt-3 text-sm text-muted">The model was unavailable, so results are ordered with simple preference rules. Requirement checks are unaffected.</p>}
      </section>

      {run.no_match && (
        <section className="rounded-lg border border-line bg-card p-5">
          <h2 className="font-display text-2xl font-bold">No documented match</h2>
          <p className="mt-1">{run.no_match.message}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {run.no_match.blockers.map((b) => (
              <li key={b.requirement}>
                <span className="font-medium">{requirementLabel(b.requirement)}:</span> {b.conflicts} conflict, {b.unknown} unknown.
                {b.would_unlock > 0 && ` Changing only this could make ${b.would_unlock} more eligible.`}
              </li>
            ))}
          </ul>
          <Link href="/" className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Change my requirements</Link>
        </section>
      )}

      {recommendations.length > 0 && (
        <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((card, i) => (
            <RecommendationCard key={card.product_id} card={card} rank={i + 1} hasPhoto={run.has_photo}
              retriesRemaining={run.retries_remaining ?? 0} retrying={retrying === card.product_id}
              onRetry={() => retry(card.product_id)}
              onOpenCheck={(check) => setPanel({ type: "check", card, check })}
              onOpenPreview={(preview) => setPanel({ type: "preview", card, preview })} />
          ))}
        </section>
      )}

      {!!run.other_eligible?.length && (
        <section>
          <h2 className="font-display text-2xl font-bold">Also eligible</h2>
          <p className="mb-3 text-sm text-muted">These also meet your requirements. Previews are limited to three products.</p>
          <div className="grid gap-3 md:grid-cols-2">{run.other_eligible.map((c) => <CompactCard key={c.product_id} card={c} onOpen={setPanel} />)}</div>
        </section>
      )}
      {!!run.needs_information?.length && (
        <section>
          <h2 className="font-display text-2xl font-bold">Needs more information</h2>
          <p className="mb-3 text-sm text-muted">The evidence could not establish these requirements, so ProofPick does not recommend these products or guess.</p>
          <div className="grid gap-3 md:grid-cols-2">{run.needs_information.map((c) => <CompactCard key={c.product_id} card={c} onOpen={setPanel} />)}</div>
        </section>
      )}
      {!!run.excluded?.length && (
        <section>
          <details>
            <summary className="cursor-pointer font-display text-2xl font-bold">Excluded ({run.excluded.length})</summary>
            <p className="my-3 text-sm text-muted">Evidence shows these conflict with a requirement.</p>
            <div className="grid gap-3 md:grid-cols-2">{run.excluded.map((c) => <CompactCard key={c.product_id} card={c} onOpen={setPanel} />)}</div>
          </details>
        </section>
      )}
      <EvidencePanel content={panel} onClose={close} />
    </main>
  );
}
