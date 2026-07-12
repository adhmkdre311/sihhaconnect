import { cn } from "@/lib/utils";

type Variant = "primary" | "reversed" | "mono";

// The Bridge Pulse mark — two arcs meeting with a single pulse line.
export function SihhaMark({
  className,
  variant = "primary",
}: {
  className?: string;
  variant?: Variant;
}) {
  if (variant === "reversed") {
    return (
      <svg viewBox="0 0 120 120" className={cn("h-6 w-6", className)} aria-hidden>
        <circle cx="46" cy="60" r="34" fill="#4FA89F" />
        <circle cx="74" cy="60" r="34" fill="#E8C077" style={{ mixBlendMode: "screen" }} />
        <path
          d="M 30 60 L 48 60 L 54 46 L 62 74 L 68 60 L 90 60"
          stroke="#FFFFFF"
          strokeWidth="4.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (variant === "mono") {
    return (
      <svg viewBox="0 0 120 120" className={cn("h-6 w-6", className)} aria-hidden>
        <circle cx="46" cy="60" r="34" fill="#16262B" />
        <circle cx="74" cy="60" r="34" fill="#16262B" fillOpacity="0.45" />
        <path
          d="M 30 60 L 48 60 L 54 46 L 62 74 L 68 60 L 90 60"
          stroke="#F6F1E7"
          strokeWidth="4.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 120" className={cn("h-6 w-6", className)} aria-hidden>
      <circle cx="46" cy="60" r="34" fill="#0E5C56" fillOpacity="0.92" />
      <circle cx="74" cy="60" r="34" fill="#D9A441" fillOpacity="0.92" style={{ mixBlendMode: "multiply" }} />
      <path
        d="M 30 60 L 48 60 L 54 46 L 62 74 L 68 60 L 90 60"
        stroke="#16262B"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SihhaLockup({
  className,
  variant = "primary",
  size = "md",
}: {
  className?: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: { mark: "h-6 w-6", text: "text-lg" },
    md: { mark: "h-8 w-8", text: "text-xl" },
    lg: { mark: "h-12 w-12", text: "text-3xl" },
  }[size];
  const textColor =
    variant === "reversed"
      ? "text-[#F6F1E7]"
      : variant === "mono"
      ? "text-foreground"
      : "text-[#16262B] dark:text-[#F6F1E7]";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SihhaMark variant={variant} className={sizes.mark} />
      <span className={cn("font-display font-bold tracking-tight", sizes.text, textColor)}>
        sihha
      </span>
    </span>
  );
}