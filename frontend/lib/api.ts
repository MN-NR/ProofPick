export type Requirements = {
  product: "top";
  max_price_usd: number | null;
  price_inclusive: boolean;
  sleeves: string | null;
  neckline: string | null;
  excluded_materials: string[];
  preferences: string[];
  preferred_colors: string[];
};

export type Evidence = {
  id: string;
  field: string;
  kind: "text" | "image";
  source: string;
  quote: string | null;
  image_url: string | null;
  collected_at: string;
};

export type Check = {
  requirement: string;
  status: ProductStatus;
  observed: string;
  method: string;
  action: string;
  explanation: string;
  evidence: Evidence[];
};

export type ProductStatus = "meets_documented_requirements" | "conflicts_with_requirement" | "insufficient_evidence";
export type PreviewStatus = "no_visible_mismatch_detected" | "possible_mismatch" | "not_assessable";

export type Feature = { feature: string; status: "consistent" | "altered" | "hidden" | "unclear"; observation: string };

export type Preview = {
  id: string;
  attempt: number;
  status: "pending" | "running" | "inspecting" | "done" | "failed" | "skipped";
  error: string | null;
  image_url: string | null;
  inspection: { status: PreviewStatus; features: Feature[]; summary: string; method: string } | null;
};

export type Card = {
  product_id: string;
  name: string;
  brand: string;
  variant: string;
  color: string;
  price: number;
  currency: string;
  description: string;
  image_url: string;
  data_label: string;
  collected_at: string;
  status: ProductStatus;
  checks: Check[];
  explanation: string | null;
  previews: Preview[];
};

export type Run = {
  run_id: string;
  state: "queued" | "checking" | "ranking" | "previewing" | "complete" | "failed";
  error: string | null;
  requirements: Requirements;
  original_text: string;
  has_photo: boolean;
  ranking_method?: "model" | "rules";
  recommendations?: Card[];
  needs_information?: Card[];
  excluded?: Card[];
  other_eligible?: Card[];
  no_match?: {
    message: string;
    blockers: { requirement: string; conflicts: number; unknown: number; would_unlock: number }[];
  } | null;
  preview_notice?: string | null;
  retries_remaining?: number;
};

export type AppConfig = {
  youcam_configured: boolean;
  model_configured: boolean;
  sample_photo_available: boolean;
  catalog_size: number;
  privacy: { providers: string[]; retention: string };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : "The request could not be completed.";
    throw new Error(detail);
  }
  return response.json();
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  config: () => request<AppConfig>("/api/config"),
  parse: (text: string) =>
    request<{ requirements: Requirements; parser: "model" | "rules"; notes: string[] }>("/api/requirements/parse", json({ text })),
  uploadPhoto: (form: FormData) => request<{ photo_id: string; is_sample: boolean }>("/api/photos", { method: "POST", body: form }),
  start: (original_text: string, requirements: Requirements, photo_id: string | null) =>
    request<{ run_id: string }>("/api/recommendations", json({ original_text, requirements, photo_id })),
  run: (id: string) => request<Run>(`/api/runs/${id}`, { cache: "no-store" }),
  retry: (id: string, product_id: string) => request(`/api/runs/${id}/retry-preview`, json({ product_id })),
  session: () => request<{ session_id: string }>("/api/session"),
  deleteSession: (id: string) => request<{ note: string }>(`/api/sessions/${id}`, { method: "DELETE" }),
};

export const SLEEVE_LABELS: Record<string, string> = {
  long: "Long",
  three_quarter: "Three-quarter",
  short: "Short",
  sleeveless: "Sleeveless",
};

export const NECKLINE_LABELS: Record<string, string> = {
  high: "High",
  crew: "Crew",
  v_neck: "V-neck",
  scoop: "Scoop",
  boat: "Boat",
  collared: "Collared",
};

export function requirementLabel(requirement: string): string {
  if (requirement === "budget") return "Budget";
  if (requirement === "sleeves") return "Sleeves";
  if (requirement === "neckline") return "Neckline";
  if (requirement === "availability") return "Availability";
  if (requirement.startsWith("exclude_")) return `No ${requirement.slice(8).replaceAll("_", " ")}`;
  return requirement;
}

export const METHOD_LABELS: Record<string, string> = {
  price_comparison: "Exact price comparison",
  material_rule: "Material rule applied to composition text",
  source_text_rule: "Rule applied to the product text",
  visual_assessment: "AI-assisted reading of the product photo",
  exact_lookup: "Exact lookup in the product record",
};
