// BUG-03: label programmatically associated via htmlFor/id.
// BUG-29: pass autoComplete through props (name/email/new-password/...).
// BUG-10: inline, translated error text with aria-describedby wiring.
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Input } from "./input";
import { Label } from "./label";
import { cn } from "@/lib/utils";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string; // translated inline error; undefined when valid
  hint?: string; // translated helper text (e.g. password rule, invite help)
  trailing?: ReactNode; // e.g. the password visibility toggle (Task 6)
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, trailing, id, className, ...inputProps },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? `field-${autoId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(trailing ? "pe-10" : undefined, className)}
          {...inputProps}
        />
        {trailing}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});