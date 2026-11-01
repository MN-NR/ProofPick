"use client";

import { NECKLINE_LABELS, Requirements, SLEEVE_LABELS } from "@/lib/api";

const field = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";
const toList = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

export function RequirementEditor({ value, onChange }: { value: Requirements; onChange: (next: Requirements) => void }) {
  const set = (patch: Partial<Requirements>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <fieldset className="rounded-lg border border-line bg-card p-4">
        <legend className="px-1 font-semibold">Non-negotiable</legend>
        <p className="mb-3 text-sm text-muted">A product is only recommended when evidence supports all of these.</p>
        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="budget">Maximum price (USD, before shipping and tax)</label>
            <input id="budget" className={field} type="number" min="0" step="1" value={value.max_price_usd ?? ""}
              onChange={(e) => set({ max_price_usd: e.target.value === "" ? null : Number(e.target.value) })} />
            <label className="mt-1 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={value.price_inclusive} onChange={(e) => set({ price_inclusive: e.target.checked })} />
              Include this exact price
            </label>
          </div>
          <div>
            <label className={label} htmlFor="sleeves">Sleeves</label>
            <select id="sleeves" className={field} value={value.sleeves ?? ""} onChange={(e) => set({ sleeves: e.target.value || null })}>
              <option value="">Any</option>
              {Object.entries(SLEEVE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="neckline">Neckline</label>
            <select id="neckline" className={field} value={value.neckline ?? ""} onChange={(e) => set({ neckline: e.target.value || null })}>
              <option value="">Any</option>
              {Object.entries(NECKLINE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="excluded">Excluded materials (comma-separated)</label>
            <input id="excluded" className={field} defaultValue={value.excluded_materials.join(", ")}
              onChange={(e) => set({ excluded_materials: toList(e.target.value.toLowerCase()) })} />
          </div>
        </div>
      </fieldset>
      <fieldset className="rounded-lg border border-line bg-card p-4">
        <legend className="px-1 font-semibold">Preferences</legend>
        <p className="mb-3 text-sm text-muted">These affect the order of results. They never override a requirement.</p>
        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="prefs">Occasion or style (comma-separated)</label>
            <input id="prefs" className={field} defaultValue={value.preferences.join(", ")}
              onChange={(e) => set({ preferences: toList(e.target.value) })} />
          </div>
          <div>
            <label className={label} htmlFor="colors">Preferred colors (comma-separated)</label>
            <input id="colors" className={field} defaultValue={value.preferred_colors.join(", ")}
              onChange={(e) => set({ preferred_colors: toList(e.target.value) })} />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
