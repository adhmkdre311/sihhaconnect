// BUG-21: password visibility toggle. Translated aria-label; aria-pressed exposes state.
// BUG-23-adjacent: inset-inline-end keeps it RTL-correct.
import { Eye, EyeOff } from "lucide-react";
import { useLang } from "@/lib/i18n";

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  const { t } = useLang();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? t("hide_password") : t("show_password")}
      aria-pressed={visible}
      tabIndex={-1}
      className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {visible ? (
        <EyeOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}