import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, CalendarPlus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant } from "@/lib/ai.functions";

export const Route = createFileRoute("/app/chat")({ component: Chat });

type Msg = { id: string; role: "user"|"assistant"; content: string; created_at: string };

function Chat() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = useServerFn(askAssistant);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    void supabase.from("chat_messages")
      .select("id, role, content, created_at")
      .eq("worker_id", user.id).order("created_at", { ascending: true }).limit(50)
      .then(({ data }) => setMsgs((data ?? []) as Msg[]));
  }, [user]);

  useEffect(() => { listRef.current?.scrollTo({ top: 99999 }); }, [msgs]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    const now = new Date().toISOString();
    setMsgs((m) => [...m, { id: "tmp"+now, role: "user", content: text, created_at: now }]);
    setInput("");
    try {
      const r = await ask({ data: { message: text, language: lang } });
      setMsgs((m) => [...m, { id: "a"+Date.now(), role: "assistant", content: r.reply, created_at: new Date().toISOString() }]);
    } catch (e) {
      setMsgs((m) => [...m, { id: "err", role: "assistant", content: (e instanceof Error?e.message:"Error"), created_at: new Date().toISOString() }]);
    } finally { setBusy(false); }
  }

  const quick = [
    "Do I need to see a doctor?",
    t("quick_medicine"),
    t("quick_prep"),
    t("quick_explain"),
  ];

  return (
    <AppShell title={t("ask_question")}>
      <div ref={listRef} className="mb-3 h-[55vh] space-y-2 overflow-y-auto rounded-2xl border bg-card p-3">
        {msgs.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
            {t("ai_disclaimer")}
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role==="user"?"bg-primary text-primary-foreground":"bg-muted"}`}>
              <p className="whitespace-pre-line">{m.content}</p>
            </div>
          </div>
        ))}
        {busy && <div className="text-xs text-muted-foreground">…</div>}
      </div>

      {msgs.some((m) => m.role === "assistant") && (
        <Link
          to="/app/book"
          className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
        >
          <CalendarPlus className="h-4 w-4" />
          Book a follow-up about this
        </Link>
      )}

      <div className="mb-2 flex gap-2 overflow-x-auto">
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => void send(q)}
            className="whitespace-nowrap rounded-full border border-accent bg-background px-3 py-1.5 text-xs font-semibold text-accent-foreground/80 transition hover:bg-accent/10"
          >
            {q}
          </button>
        ))}
      </div>

      <form onSubmit={(e)=>{e.preventDefault(); void send(input);}} className="flex gap-2">
        <Input value={input} onChange={(e)=>setInput(e.target.value)} placeholder={t("chat_placeholder")} />
        <Button type="submit" size="icon" disabled={busy}><Send className="h-4 w-4" /></Button>
      </form>
    </AppShell>
  );
}
