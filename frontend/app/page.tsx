"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PhotoPicker } from "@/components/PhotoPicker";
import { RequirementEditor } from "@/components/RequirementEditor";
import { Button, ErrorNote } from "@/components/ui";
import { api, AppConfig, Requirements } from "@/lib/api";

const EXAMPLE = "I need a long-sleeved, high-neck top under $60, without polyester. I prefer something suitable for work.";

export default function RequestPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [text, setText] = useState("");
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
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
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <section>
        <h1 className="font-display text-3xl font-bold md:text-4xl">Tell us what the top has to be.</h1>
        <p className="mt-2 text-muted">
          ProofPick checks each requirement against product evidence and tells you when something is missing.
        </p>
        <label htmlFor="request" className="sr-only">Describe what you need</label>
        <textarea id="request" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE}
          className="mt-4 w-full rounded-lg border border-line bg-white p-4 text-lg" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button disabled={!text.trim() || busy} onClick={readRequest}>{busy && !requirements ? "Reading your request…" : "Read my request"}</Button>
          <Button variant="quiet" onClick={() => setText(EXAMPLE)}>Use the example</Button>
        </div>
      </section>

      {requirements && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl font-bold">Is this right?</h2>
            <p className="text-sm text-muted">Nothing is searched until you confirm. Prices are in USD. This version covers tops only.</p>
            {notes.map((n) => <p key={n} className="mt-2 rounded-md bg-warn-bg px-3 py-2 text-sm text-warn">{n}</p>)}
          </div>
          <RequirementEditor key={revision} value={requirements} onChange={setRequirements} />
          <PhotoPicker config={config} photoId={photoId} onChange={setPhotoId} />
          {config && !config.youcam_configured && (
            <p className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn">Try-on is not configured on this server, so previews will show as unavailable.</p>
          )}
          <Button disabled={busy} onClick={search}>{busy ? "Starting…" : "Confirm and find tops"}</Button>
        </section>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </main>
  );
}
