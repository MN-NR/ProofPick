"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PhotoPicker } from "@/components/PhotoPicker";
import { RequirementEditor } from "@/components/RequirementEditor";
import { Button, ErrorNote, Eyebrow, IconArrowRight, IconCamera, IconCheck, IconNeedle, IconSparkle, Notice, Seal, Spinner, Tape } from "@/components/ui";
import { api, AppConfig, Requirements } from "@/lib/api";

const EXAMPLE = "I need a long-sleeved, high-neck top under $60, without polyester. I prefer something suitable for work.";
const STEPS = ["Describe", "Confirm", "Compare"];
const IDEAS = [
  "A short-sleeved crew-neck tee under $30 for casual days",
  "Three-quarter sleeves and a boat neck, under $50, polished for work",
  "A high-neck top up to $60 in black or forest, no polyester",
];
const HOW = [
  { title: "Describe", text: "Write what the top has to be: budget, sleeves, neckline, materials to avoid. You confirm every field before anything is searched.", Icon: IconNeedle },
  { title: "Check", text: "Each requirement is checked against the product's own evidence. When information is missing, ProofPick says so instead of guessing.", Icon: IconCheck },
  { title: "Try on", text: "Add a photo to see try-on previews, with a check of whether each preview kept the garment's visible details.", Icon: IconCamera },
];

function Thread() {
  return (
    <svg aria-hidden="true" viewBox="0 0 220 18" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3.5 w-full text-gold">
      <path d="M2 11c20-8 38 6 58-1s38-8 56 0 40 6 58-2 30-4 44 1" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 5" />
    </svg>
  );
}

export default function RequestPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [text, setText] = useState("");
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [parser, setParser] = useState<"model" | "rules" | null>(null);
  const [revision, setRevision] = useState(0);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.config().then(setConfig).catch(() => setError("The ProofPick service could not be reached."));
  }, []);

  async function readRequest() {
    setBusy(true);
    setError(null);
    try {
      const parsed = await api.parse(text);
      setRequirements(parsed.requirements);
      setNotes(parsed.notes);
      setParser(parsed.parser);
      setRevision((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function search() {
    if (!requirements) return;
    setBusy(true);
    setError(null);
    try {
      const { run_id } = await api.start(text, requirements, photoId);
      router.push(`/runs/${run_id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="grid items-start gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="animate-rise lg:col-span-5 lg:pt-4">
          <Eyebrow n={1}>Describe</Eyebrow>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.98] tracking-tight text-ink sm:text-6xl">
            Tell us what the top <em className="relative inline-block italic text-brand">has to be.<Thread /></em>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            ProofPick checks each requirement against product evidence and tells you when something is missing.
          </p>
          <div className="mt-10 max-w-md"><Tape steps={STEPS} current={requirements ? 1 : 0} /></div>
        </div>

        <div className="relative animate-rise [animation-delay:120ms] lg:col-span-7">
          <span aria-hidden="true" className="absolute -top-3 left-1/2 z-[1] h-6 w-28 -translate-x-1/2 -rotate-3 bg-gold/35 shadow-sm" />
          <div className="stitch rounded-md border border-line bg-card p-5 shadow-lift transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 sm:p-8">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              <span className="text-brand">Order slip</span><span>Tops · USD</span>
            </div>
            <label htmlFor="request" className="sr-only">Describe what you need</label>
            <textarea id="request" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE}
              className="ruled mt-2 block w-full resize-y border-0 bg-transparent px-1 py-0 font-display text-xl leading-9 text-ink placeholder:italic placeholder:text-muted/75 focus:outline-none" />
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Button variant="quiet" onClick={() => setText(EXAMPLE)}>Use the example</Button>
              <Button disabled={!text.trim() || busy} onClick={readRequest}>
                {busy && !requirements ? <><Spinner />Reading your request…</> : <>Read my request<IconArrowRight /></>}
              </Button>
            </div>
            <div className="mt-6 border-t border-dashed border-line-strong pt-4">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">More ideas</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {IDEAS.map((idea) => (
                  <button key={idea} onClick={() => setText(idea)}
                    className="rounded-full border border-dashed border-brand/35 bg-paper/60 px-3.5 py-1.5 text-left text-[13px] text-ink transition hover:border-brand hover:bg-brand-soft">
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {!requirements && (
        <section aria-labelledby="how-heading" className="mt-24 animate-rise [animation-delay:240ms]">
          <div className="flex items-center gap-4">
            <h2 id="how-heading" className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">How it works</h2>
            <span aria-hidden="true" className="flex-1 border-t border-dashed border-brand/30" />
          </div>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {HOW.map(({ title, text: body, Icon }, i) => (
              <li key={title} className="stitch group rounded-md border border-line bg-card p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <Seal className="transition duration-300 group-hover:-rotate-12">{i + 1}</Seal>
                  <Icon className="size-6 text-gold" />
                </div>
                <h3 className="mt-5 font-display text-2xl font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {requirements && (
        <section className="mt-20 animate-rise space-y-6">
          <div className="border-b border-dashed border-brand/30 pb-6">
            <Eyebrow n={2}>Confirm</Eyebrow>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Is this <em className="italic text-brand">right?</em></h2>
              {parser === "model" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-3 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ok ring-1 ring-inset ring-ok/25">
                  <IconSparkle className="size-3.5" />Read by AI
                </span>
              )}
            </div>
            <p className="mt-3 text-sm text-muted">Nothing is searched until you confirm. Prices are in USD. This version covers tops only.</p>
          </div>
          {notes.map((n) => <Notice key={n} tone="warn">{n}</Notice>)}
          <RequirementEditor key={revision} value={requirements} onChange={setRequirements} />
          <PhotoPicker config={config} photoId={photoId} onChange={setPhotoId} />
          {config && !config.youcam_configured && (
            <Notice tone="warn">Try-on is not configured on this server, so previews will show as unavailable.</Notice>
          )}
          <div className="flex justify-end border-t border-dashed border-brand/30 pt-6">
            <Button size="lg" className="w-full sm:w-auto" disabled={busy} onClick={search}>
              {busy ? <><Spinner />Starting…</> : <>Confirm and find tops<IconArrowRight /></>}
            </Button>
          </div>
        </section>
      )}
      {error && <div className="mt-6"><ErrorNote>{error}</ErrorNote></div>}
    </main>
  );
}
