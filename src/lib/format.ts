// E6: localized date / number formatting shared by every portal.
import { useLang } from "@/lib/i18n";

const LOCALES: Record<string, string> = {
  en: "en-GB", ar: "ar-QA", hi: "hi-IN", ur: "ur-PK",
  ne: "ne-NP", tl: "fil-PH", bn: "bn-BD",
};

export function localeFor(lang: string) {
  return LOCALES[lang] ?? "en-GB";
}

export function formatDateTime(value: string | number | Date, lang: string) {
  return new Date(value).toLocaleString(localeFor(lang), {
    dateStyle: "medium", timeStyle: "short",
  });
}

export function formatDate(value: string | number | Date, lang: string) {
  return new Date(value).toLocaleDateString(localeFor(lang), { dateStyle: "medium" } as Intl.DateTimeFormatOptions);
}

export function formatTime(value: string | number | Date, lang: string) {
  return new Date(value).toLocaleTimeString(localeFor(lang), { hour: "2-digit", minute: "2-digit" });
}

export function formatNumber(value: number, lang: string, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(localeFor(lang), options).format(value);
}

export function formatCurrency(value: number, lang: string, currency = "QAR") {
  return new Intl.NumberFormat(localeFor(lang), { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

/** Hook flavour so screens don't have to thread `lang` through by hand. */
export function useFormat() {
  const { lang } = useLang();
  return {
    locale: localeFor(lang),
    dateTime: (v: string | number | Date) => formatDateTime(v, lang),
    date: (v: string | number | Date) => formatDate(v, lang),
    time: (v: string | number | Date) => formatTime(v, lang),
    number: (v: number, o?: Intl.NumberFormatOptions) => formatNumber(v, lang, o),
    currency: (v: number, c?: string) => formatCurrency(v, lang, c),
  };
}
