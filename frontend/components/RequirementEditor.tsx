"use client";

import { NECKLINE_LABELS, Requirements, SLEEVE_LABELS } from "@/lib/api";
import { IconChevronDown } from "./ui";

const line = "w-full rounded-none border-0 border-b-2 border-line-strong bg-transparent py-2 text-ink transition hover:border-muted focus:border-brand focus:bg-brand-soft/40 focus:outline-none";
const field = `${line} px-1 text-[15px]`;
const label = "block text-sm font-medium text-ink";
const toList = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

function Piece({ letter, dark }: { letter: string; dark?: boolean }) {
  return <span aria-hidden="true" className={`font-mono text-[10px] uppercase tracking-[0.2em] ${dark ? "text-card/75" : "text-muted"}`}>Piece {letter}</span>;
}

export function RequirementEditor({ value, onChange }: { value: Requirements; onChange: (next: Requirements) => void }) {
  const set = (patch: Partial<Requirements>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <fieldset className="stitch overflow-hidden rounded-md border border-line bg-card shadow-card">
        <legend className="float-left flex w-full items-center justify-between gap-3 bg-brand px-5 py-3.5 text-card sm:px-6">
          <span className="font-display text-xl font-semibold">Non-negotiable</span><Piece letter="A" dark />
        </legend>
        <div className="clear-both space-y-5 p-5 sm:p-6">
          <p className="text-sm text-muted">A product is only recommended when evidence supports all of these.</p>
          <div>
            <label className={label} htmlFor="budget">Maximum price (USD, before shipping and tax)</label>
            <div className="relative mt-1">
              <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1 font-display text-xl text-brand">$</span>
              <input id="budget" className={`${line} pl-6 pr-1 font-display text-xl tabular-nums`} type="number" min="0" step="1" value={value.max_price_usd ?? ""}
                onChange={(e) => set({ max_price_usd: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <label className="mt-2.5 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="size-4 accent-brand" checked={value.price_inclusive} onChange={(e) => set({ price_inclusive: e.target.checked })} />
              Include this exact price
            </label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="sleeves">Sleeves</label>
              <div className="relative mt-1">
                <select id="sleeves" className={`${field} cursor-pointer appearance-none pr-7`} value={value.sleeves ?? ""} onChange={(e) => set({ sleeves: e.target.value || null })}>
                  <option value="">Any</option>
                  {Object.entries(SLEEVE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <IconChevronDown className="pointer-events-none absolute bottom-3 right-1 size-4 text-brand" />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="neckline">Neckline</label>
              <div className="relative mt-1">
                <select id="neckline" className={`${field} cursor-pointer appearance-none pr-7`} value={value.neckline ?? ""} onChange={(e) => set({ neckline: e.target.value || null })}>
                  <option value="">Any</option>
                  {Object.entries(NECKLINE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <IconChevronDown className="pointer-events-none absolute bottom-3 right-1 size-4 text-brand" />
              </div>
            </div>
          </div>
          <div>
            <label className={label} htmlFor="excluded">Excluded materials (comma-separated)</label>
            <input id="excluded" className={`${field} mt-1`} defaultValue={value.excluded_materials.join(", ")}
              onChange={(e) => set({ excluded_materials: toList(e.target.value.toLowerCase()) })} />
          </div>
        </div>
      </fieldset>
      <fieldset className="stitch overflow-hidden rounded-md border border-line bg-card shadow-card">
        <legend className="float-left flex w-full items-center justify-between gap-3 border-b border-line bg-sand px-5 py-3.5 text-ink sm:px-6">
          <span className="font-display text-xl font-semibold">Preferences</span><Piece letter="B" />
        </legend>
        <div className="clear-both space-y-5 p-5 sm:p-6">
          <p className="text-sm text-muted">These affect the order of results. They never override a requirement.</p>
          <div>
            <label className={label} htmlFor="prefs">Occasion or style (comma-separated)</label>
            <input id="prefs" className={`${field} mt-1`} defaultValue={value.preferences.join(", ")}
              onChange={(e) => set({ preferences: toList(e.target.value) })} />
          </div>
          <div>
            <label className={label} htmlFor="colors">Preferred colors (comma-separated)</label>
            <input id="colors" className={`${field} mt-1`} defaultValue={value.preferred_colors.join(", ")}
              onChange={(e) => set({ preferred_colors: toList(e.target.value) })} />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
