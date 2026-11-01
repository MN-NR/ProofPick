"use client";

import { useState } from "react";
import { api, AppConfig } from "@/lib/api";
import { Button, ErrorNote } from "./ui";

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
    <section className="rounded-lg border border-line bg-card p-4">
      <h2 className="font-semibold">Try-on photo <span className="font-normal text-muted">(optional)</span></h2>
      <p className="mt-1 text-sm text-muted">
        Use a clear chest-up photo of one person facing forward, with their shoulders and whole face visible. JPEG or PNG, under 10 MB.
      </p>
      {photoId ? (
        <div className="mt-3 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/${photoId}/image`} alt="Your selected try-on photo" className="h-28 rounded-md object-cover" />
          <Button variant="quiet" onClick={() => onChange(null)}>Remove photo</Button>
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-1 text-sm">
            <label className="flex items-start gap-2">
              <input className="mt-1" type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              This photo shows an adult.
            </label>
            <label className="flex items-start gap-2">
              <input className="mt-1" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              I have that person&apos;s consent to send this photo to the providers listed below.
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input type="file" accept="image/jpeg,image/png" disabled={!adult || !consent || busy} aria-label="Choose a photo"
              className="text-sm disabled:opacity-50" onChange={(e) => upload(e.target.files?.[0])} />
            {config?.sample_photo_available && (
              <Button variant="quiet" disabled={busy} onClick={useSample}>Use the consented sample model</Button>
            )}
          </div>
        </>
      )}
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      {config && (
        <div className="mt-3 border-t border-line pt-3 text-xs text-muted">
          <p>Who receives the photo: {config.privacy.providers.join("; ")}.</p>
          <p className="mt-1">{config.privacy.retention}</p>
        </div>
      )}
    </section>
  );
}
