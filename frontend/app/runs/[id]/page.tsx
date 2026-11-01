"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EvidencePanel, PanelContent } from "@/components/EvidencePanel";
import { CheckRows, RecommendationCard, TAG_SHAPE } from "@/components/RecommendationCard";
import { Button, buttonClass, ErrorNote, Eyebrow, IconArrowLeft, IconArrowRight, IconChevronDown, IconSparkle, IconTrash, Notice, Spinner, Tape } from "@/components/ui";
import { api, Card, requirementLabel, Run } from "@/lib/api";

const STAGE_TEXT: Record<string, string> = {
  queued: "Starting your search…",
  checking: "Checking product evidence…",
  ranking: "Ranking eligible products…",
  previewing: "Creating your previews…",
};
const STAGES = ["queued", "checking", "ranking", "previewing"];
const STAGE_LABELS = ["Start", "Check", "Rank", "Preview"];

function CompactCard({ card, onOpen }: { card: Card; onOpen: (content: PanelContent) => void }) {
  const failing = card.checks.filter((c) => c.status !== "meets_documented_requirements");
  return (
    <article className="flex gap-4 rounded-md border border-line bg-card p-4 shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="pinked flex-none self-start bg-linear-to-b from-sand to-paper px-1.5 py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.image_url} alt={`Original ${card.name}`} className="size-20 object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h4 className="font-display text-lg font-semibold leading-tight text-ink">{card.name}</h4>
          <span className="font-mono text-sm font-medium tabular-nums text-brand">${card.price.toFixed(2)}</span>
        </div>
        <div className="mt-1"><CheckRows checks={failing.length ? failing : card.checks} onOpen={(check) => onOpen({ type: "check", card, check })} /></div>
      </div>
    </article>
  );
}

function SectionHead({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-6 border-b border-dashed border-brand/30 pb-4">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">{title}</h2>
        <span className="rounded-full bg-sand px-2.5 py-0.5 font-mono text-xs font-medium text-muted">{count}</span>
      </div>
      <p className="mt-1.5 text-sm text-muted">{children}</p>
    </div>
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
    return (
      <main className="mx-auto max-w-xl px-4 py-20">
        <ErrorNote>{error}</ErrorNote>
        <Link href="/" className="mt-5 inline-block font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand">Start a new search</Link>
      </main>
    );
  }
  if (!run) {
    return <main className="mx-auto flex max-w-xl items-center justify-center gap-3 px-4 py-24 font-display text-xl text-muted" role="status"><Spinner className="size-5 text-brand" />Loading…</main>;
  }

  const recommendations = run.recommendations ?? [];
  const usedRules = run.ranking_method === "rules" && recommendations.length > 1;
  const tally = [
    { id: "picks", label: "Top picks", n: recommendations.length },
    { id: "eligible", label: "Also eligible", n: run.other_eligible?.length ?? 0 },
    { id: "needs-info", label: "Need more information", n: run.needs_information?.length ?? 0 },
    { id: "excluded", label: "Excluded", n: run.excluded?.length ?? 0 },
  ];
  const openExcluded = () => document.getElementById("excluded-details")?.setAttribute("open", "");
  return (
    <main className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:px-6 sm:py-14">
      <section className="animate-rise">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-dashed border-brand/30 pb-8">
          <div className="min-w-0 max-w-3xl">
            <Eyebrow n={3}>Compare</Eyebrow>
            <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">Your <em className="italic text-brand">results</em></h1>
            {run.original_text && <p className="mt-4 font-display text-xl italic leading-snug text-muted">“{run.original_text}”</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={buttonClass("quiet")}><IconArrowLeft />Edit or start again</Link>
            <Button variant="quiet" onClick={deleteData}><IconTrash />Delete my data</Button>
          </div>
        </div>
        {active && (
          <div className="stitch mt-8 rounded-md border border-line bg-card p-5 shadow-card sm:p-7">
            <p role="status" className="flex items-center gap-3 font-display text-xl text-ink"><Spinner className="size-5 text-brand" />{STAGE_TEXT[run.state]}</p>
            <div className="mt-6"><Tape steps={STAGE_LABELS} current={Math.max(0, STAGES.indexOf(run.state))} decorative /></div>
          </div>
        )}
        <div className="mt-6 space-y-3">
          {run.state === "failed" && <ErrorNote>{run.error}</ErrorNote>}
          {run.preview_notice && <Notice tone="warn">{run.preview_notice}</Notice>}
          {retryError && <ErrorNote>{retryError}</ErrorNote>}
          {usedRules && <Notice tone="info">The model was unavailable, so results are ordered with simple preference rules. Requirement checks are unaffected.</Notice>}
        </div>
        {run.state === "complete" && (
          <nav aria-label="Result summary" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tally.map((t) => {
              const body = (
                <>
                  <span className="block font-display text-4xl font-semibold tabular-nums text-brand">{t.n}</span>
                  <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">{t.label}</span>
                </>
              );
              const look = "rounded-md border border-line bg-card px-4 py-3.5 shadow-card";
              return t.n > 0
                ? <a key={t.id} href={`#${t.id}`} onClick={t.id === "excluded" ? openExcluded : undefined} className={`${look} transition duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift`}>{body}</a>
                : <div key={t.id} className={look}>{body}</div>;
            })}
          </nav>
        )}
      </section>

      {active && !recommendations.length && (
        <div aria-hidden="true" className="grid gap-x-7 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={["pt-8", "hidden pt-8 md:block", "hidden pt-8 lg:block"][i]}>
              <div className={`skeleton h-[34rem] ${TAG_SHAPE}`} style={{ animationDelay: `${i * 200}ms` }} />
            </div>
          ))}
        </div>
      )}

      {run.no_match && (
        <section className="stitch animate-rise overflow-hidden rounded-md border border-line bg-card shadow-card">
          <div className="bg-brand px-6 py-5 text-card sm:px-8">
            <h2 className="font-display text-3xl font-semibold">No documented match</h2>
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-ink">{run.no_match.message}</p>
            <ul className="mt-4 divide-y divide-dashed divide-line text-sm text-ink">
              {run.no_match.blockers.map((b) => (
                <li key={b.requirement} className="py-2.5">
                  <span className="font-medium">{requirementLabel(b.requirement)}:</span> {b.conflicts} conflict, {b.unknown} unknown.
                  {b.would_unlock > 0 && ` Changing only this could make ${b.would_unlock} more eligible.`}
                </li>
              ))}
            </ul>
            <Link href="/" className={`${buttonClass("primary")} mt-6`}>Change my requirements<IconArrowRight /></Link>
          </div>
        </section>
      )}

      {recommendations.length > 0 && (
        <section id="picks" className="scroll-mt-24">
          {run.ranking_method === "model" && recommendations.length > 1 && (
            <p className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              <IconSparkle className="size-3.5 text-brand" />Ordered by AI from your preferences
            </p>
          )}
          <div className="grid gap-x-7 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((card, i) => (
              <div key={card.product_id} className="animate-rise" style={{ animationDelay: `${i * 90}ms` }}>
                <RecommendationCard card={card} rank={i + 1} hasPhoto={run.has_photo}
                  retriesRemaining={run.retries_remaining ?? 0} retrying={retrying === card.product_id}
                  onRetry={() => retry(card.product_id)}
                  onOpenCheck={(check) => setPanel({ type: "check", card, check })}
                  onOpenPreview={(preview) => setPanel({ type: "preview", card, preview })} />
              </div>
            ))}
          </div>
        </section>
      )}

      {!!run.other_eligible?.length && (
        <section id="eligible" className="scroll-mt-24">
          <SectionHead title="Also eligible" count={run.other_eligible.length}>These also meet your requirements. Previews are limited to three products.</SectionHead>
          <div className="grid gap-4 md:grid-cols-2">{run.other_eligible.map((c) => <CompactCard key={c.product_id} card={c} onOpen={setPanel} />)}</div>
        </section>
      )}
      {!!run.needs_information?.length && (
        <section id="needs-info" className="scroll-mt-24">
          <SectionHead title="Needs more information" count={run.needs_information.length}>The evidence could not establish these requirements, so ProofPick does not recommend these products or guess.</SectionHead>
          <div className="grid gap-4 md:grid-cols-2">{run.needs_information.map((c) => <CompactCard key={c.product_id} card={c} onOpen={setPanel} />)}</div>
        </section>
      )}
      {!!run.excluded?.length && (
        <section id="excluded" className="scroll-mt-24">
          <details id="excluded-details" className="group rounded-md border border-line bg-card/60 shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md px-5 py-4 transition hover:bg-card sm:px-6 [&::-webkit-details-marker]:hidden">
              <span className="font-display text-3xl font-semibold tracking-tight text-ink">Excluded ({run.excluded.length})</span>
              <IconChevronDown className="size-5 flex-none text-brand transition duration-300 group-open:rotate-180" />
            </summary>
            <div className="border-t border-dashed border-line px-5 pb-6 sm:px-6">
              <p className="my-4 text-sm text-muted">Evidence shows these conflict with a requirement.</p>
              <div className="grid gap-4 md:grid-cols-2">{run.excluded.map((c) => <CompactCard key={c.product_id} card={c} onOpen={setPanel} />)}</div>
            </div>
          </details>
        </section>
      )}
      <EvidencePanel content={panel} onClose={close} />
    </main>
  );
}
