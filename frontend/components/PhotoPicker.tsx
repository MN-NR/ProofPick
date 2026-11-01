"use client";

import { useState } from "react";
import { api, AppConfig } from "@/lib/api";
import { Button, ErrorNote, IconCamera, IconInfo } from "./ui";

const consentRow = "flex cursor-pointer items-start gap-3 rounded-md border border-line bg-paper/60 px-3.5 py-3 transition hover:border-line-strong has-checked:border-brand/50 has-checked:bg-brand-soft/60";

export function PhotoPicker({ config, photoId, onChange }: { config: AppConfig | null; photoId: string | null; onChange: (id: string | null) => void }) {
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      onChange((await api.uploadPhoto(form)).photo_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function upload(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("consent", String(consent));
    form.set("adult", String(adult));
    void send(form);
  }

  function useSample() {
    const form = new FormData();
    form.set("use_sample", "true");
    void send(form);
  }

  return (
    <section className="stitch rounded-md border border-line bg-card p-5 shadow-card sm:p-7">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="grid size-11 flex-none place-items-center rounded-full bg-brand-soft text-brand ring-1 ring-brand/15">
          <IconCamera className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold text-ink">Try-on photo <span className="font-sans text-sm font-normal text-muted">(optional)</span></h2>
          <p className="mt-1 text-sm text-muted">
            Use a clear chest-up photo of one person facing forward, with their shoulders and whole face visible. JPEG or PNG, under 10 MB.
          </p>
        </div>
      </div>
      {photoId ? (
        <div className="mt-6 flex flex-wrap items-center gap-6">
          <div className="-rotate-2 bg-card p-2 pb-7 shadow-lift ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${photoId}/image`} alt="Your selected try-on photo" className="h-32 object-cover" />
          </div>
          <Button variant="quiet" onClick={() => onChange(null)}>Remove photo</Button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 text-sm text-ink sm:grid-cols-2">
            <label className={consentRow}>
              <input className="mt-0.5 size-4 flex-none accent-brand" type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              This photo shows an adult.
            </label>
            <label className={consentRow}>
              <input className="mt-0.5 size-4 flex-none accent-brand" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              I have that person&apos;s consent to send this photo to the providers listed below.
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border-2 border-dashed border-line-strong bg-paper/50 p-4">
            <input type="file" accept="image/jpeg,image/png" disabled={!adult || !consent || busy} aria-label="Choose a photo"
              className="min-w-0 max-w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-card hover:file:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50 disabled:file:cursor-not-allowed"
              onChange={(e) => upload(e.target.files?.[0])} />
            {config?.sample_photo_available && (
              <Button variant="quiet" disabled={busy} onClick={useSample}>Use the consented sample model</Button>
            )}
          </div>
        </>
      )}
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      {config && (
        <div className="mt-5 flex gap-2.5 border-t border-dashed border-line-strong pt-4 text-xs text-muted">
          <IconInfo className="mt-px size-3.5 flex-none" />
          <div>
            <p>Who receives the photo: {config.privacy.providers.join("; ")}.</p>
            <p className="mt-1">{config.privacy.retention}</p>
          </div>
        </div>
      )}
    </section>
  );
}
