// BUG-28: per-route, translated document titles.
import { useEffect } from "react";
import { useLang } from "./i18n";

export function useDocumentTitle(titleKey: string) {
  const { t, lang } = useLang();
  useEffect(() => {
    document.title = `Sihha — ${t(titleKey)}`;
  }, [t, lang, titleKey]);
}