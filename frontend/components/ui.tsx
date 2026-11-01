import type { PreviewStatus, ProductStatus } from "@/lib/api";

type IconProps = { className?: string };
const svg = (path: React.ReactNode) => function Icon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {path}
    </svg>
  );
};

export const IconCheck = svg(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const IconX = svg(<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />);
export const IconQuestion = svg(<><path d="M9.3 9a2.8 2.8 0 015.4 1c0 1.9-2.7 2.4-2.7 4" /><path d="M12 18h.01" /></>);
export const IconAlert = svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></>);
export const IconInfo = svg(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5h.01" /></>);
export const IconArrowRight = svg(<path d="M5 12h14M13 6l6 6-6 6" />);
export const IconArrowLeft = svg(<path d="M19 12H5M11 6l-6 6 6 6" />);
export const IconChevronDown = svg(<path d="M6 9l6 6 6-6" />);
export const IconCamera = svg(<><path d="M4 8.5A1.5 1.5 0 015.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5z" /><circle cx="12" cy="13" r="3.5" /></>);
export const IconNeedle = svg(<><path d="M19.5 4.5L6 18" /><ellipse cx="18" cy="6" rx="1.2" ry="2.4" transform="rotate(45 18 6)" /><path d="M6 18c-1.5 1.5-3 1-3.5 0s1-2.5 3-2" /></>);
export const IconSparkle = svg(<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />);
export const IconTrash = svg(<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />);

const TONES = {
  ok: "bg-ok-bg text-ok ring-ok/25",
  bad: "bg-bad-bg text-bad ring-bad/25",
  warn: "bg-warn-bg text-warn ring-warn/25",
};
const TONE_ICONS = { ok: IconCheck, bad: IconX, warn: IconQuestion };

export function Pill({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  const Icon = TONE_ICONS[tone];
  return (
    <span className={`inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider ring-1 ring-inset ${TONES[tone]}`}>
      <Icon className="size-3" />{children}
    </span>
  );
}

export function CheckPill({ status }: { status: ProductStatus }) {
  if (status === "meets_documented_requirements") return <Pill tone="ok">Supported</Pill>;
  if (status === "conflicts_with_requirement") return <Pill tone="bad">Conflict</Pill>;
  return <Pill tone="warn">Unknown</Pill>;
}

export function PreviewPill({ status }: { status: PreviewStatus }) {
  if (status === "no_visible_mismatch_detected") return <Pill tone="ok">No visible mismatch detected</Pill>;
  if (status === "possible_mismatch") return <Pill tone="bad">Possible mismatch</Pill>;
  return <Pill tone="warn">Could not be checked</Pill>;
}

type ButtonVariant = "primary" | "quiet";
type ButtonSize = "md" | "lg";

/** Shared button look, also used for links that act as buttons. The primary one is a stitched wine ribbon. */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  const look = variant === "primary"
    ? "stitch-light shine bg-brand text-card shadow-brand hover:bg-brand-deep"
    : "border border-line-strong bg-card text-ink hover:border-brand hover:text-brand";
  const scale = size === "lg" ? "px-7 py-3.5 text-[15px]" : "px-5 py-2.5 text-sm";
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand focus-visible:outline-solid active:translate-y-px disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none ${scale} ${look}`;
}

export function Button({ variant = "primary", size = "md", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function Spinner({ className = "size-4" }: IconProps) {
  return <span aria-hidden="true" className={`inline-block flex-none animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

/** Section marker in the style of a pattern piece: "N° 01 —— Describe". */
export function Eyebrow({ n, className = "", children }: { n?: number; className?: string; children: React.ReactNode }) {
  return (
    <p className={`flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brand ${className}`}>
      {n !== undefined && <><span>N° {String(n).padStart(2, "0")}</span><span aria-hidden="true" className="h-px w-8 bg-brand/40" /></>}
      <span>{children}</span>
    </p>
  );
}

/** A round wine seal, like a wax stamp. Decorative. */
export function Seal({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className={`grid size-12 place-items-center rounded-full bg-brand font-display text-lg font-semibold text-card shadow-brand ring-4 ring-brand/15 ${className}`}>
      <span className="grid size-10 place-items-center rounded-full border border-dashed border-card/60">{children}</span>
    </span>
  );
}

/** Progress drawn as a tape measure, with a wine needle at the current step. */
export function Tape({ steps, current, decorative = false }: { steps: string[]; current: number; decorative?: boolean }) {
  const at = (i: number) => `${((i + 0.5) / steps.length) * 100}%`;
  return (
    <div aria-hidden={decorative || undefined}>
      <div className="relative">
        <div className="tape h-8 rounded-[3px] border border-line-strong shadow-card" />
        <span className="absolute inset-y-0 left-0 w-2 rounded-l-[3px] bg-gold" />
        {steps.map((s, i) => (
          <span key={s} className="absolute bottom-0.5 -translate-x-1/2 font-mono text-[10px] font-medium text-brand" style={{ left: at(i) }}>{i + 1}</span>
        ))}
        <span className="absolute -top-2 h-[calc(100%+1rem)] w-0.5 -translate-x-1/2 rounded-full bg-brand transition-[left] duration-700" style={{ left: at(current) }}>
          <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-brand ring-2 ring-card" />
        </span>
      </div>
      <ol className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => (
          <li key={s} aria-current={i === current ? "step" : undefined}
            className={`flex items-center justify-center gap-1 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] ${i === current ? "font-semibold text-brand" : "text-muted"}`}>
            {i < current && <IconCheck className="size-3 flex-none" />}{s}
          </li>
        ))}
      </ol>
    </div>
  );
}

const NOTICE_TONES = {
  warn: { look: "border-warn bg-warn-bg text-warn", Icon: IconAlert },
  info: { look: "border-line-strong bg-card text-ink", Icon: IconInfo },
};

export function Notice({ tone = "warn", className = "", children, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { tone?: keyof typeof NOTICE_TONES }) {
  const { look, Icon } = NOTICE_TONES[tone];
  return (
    <p className={`flex items-start gap-2.5 rounded-r-lg border-l-[3px] px-4 py-3 text-sm ${look} ${className}`} {...props}>
      <Icon className="mt-0.5 size-4 flex-none" /><span>{children}</span>
    </p>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2.5 rounded-r-lg border-l-[3px] border-bad bg-bad-bg px-4 py-3 text-sm text-bad">
      <IconAlert className="mt-0.5 size-4 flex-none" /><span>{children}</span>
    </p>
  );
}
