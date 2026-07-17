import { LANGUAGES, useLang } from "@/lib/i18n";

// BUG-22: shared language switcher — identical behavior on landing and /auth.
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={`rounded-full border px-4 py-2 text-sm transition ${
            lang === l.code
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:border-primary hover:text-primary"
          }`}
        >
          {l.native}
        </button>
      ))}
    </div>
  );
}