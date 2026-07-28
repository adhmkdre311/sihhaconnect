import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { acceptClinicInvite, previewClinicInvite } from "@/lib/clinicStaff.functions";
import { Button } from "@/components/ui/button";
import { SihhaLockup } from "@/components/SihhaLogo";
import { toast } from "sonner";

type Preview =
  | { ok: true; emailMatches: boolean; invitedEmail: string; clinicName: string; perms: { can_view_queue: boolean; can_edit_slots: boolean; can_add_documents: boolean; can_manage_staff: boolean } }
  | { ok: false; reason: "not_found" | "used" | "expired"; status?: string };

export const Route = createFileRoute("/clinic/accept-invite")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
  component: AcceptInvite,
});

function AcceptInvite() {
  const { token } = Route.useSearch();
  const { user, loading, refreshRoles } = useAuth();
  const nav = useNavigate();
  const preview = useServerFn(previewClinicInvite);
  const accept = useServerFn(acceptClinicInvite);
  const [state, setState] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth", search: { role: "clinic_staff", mode: "login", next: `/clinic/accept-invite?token=${token}` } });
      return;
    }
    if (!token) return;
    void preview({ data: { token } }).then((r) => setState(r as Preview)).catch((e) => setState({ ok: false, reason: "not_found" }));
  }, [loading, user, token]);

  async function onAccept() {
    setBusy(true);
    try {
      await accept({ data: { token } });
      await refreshRoles();
      toast.success("Welcome to the team!");
      nav({ to: "/clinic" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not accept invite");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !state) {
    return <div className="p-6 text-sm text-muted-foreground">Loading invite…</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <SihhaLockup size="sm" />
          <Link to="/" className="text-xs text-primary underline">Home</Link>
        </div>
        {!state.ok ? (
          <>
            <h1 className="font-display text-xl font-semibold">Invite unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.reason === "expired" && "This invitation has expired. Ask a clinic manager to send a new one."}
              {state.reason === "used" && "This invitation has already been used or revoked."}
              {state.reason === "not_found" && "We couldn't find that invitation."}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold">Join {state.clinicName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">You've been invited to join as clinic staff.</p>
            <ul className="my-4 space-y-1 text-sm">
              <li>{state.perms.can_view_queue ? "✅" : "—"} View queue</li>
              <li>{state.perms.can_edit_slots ? "✅" : "—"} Manage slots</li>
              <li>{state.perms.can_add_documents ? "✅" : "—"} Add patient documents</li>
              <li>{state.perms.can_manage_staff ? "✅" : "—"} Manage staff</li>
            </ul>
            {!state.emailMatches && (
              <div className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                This invite was sent to <strong>{state.invitedEmail}</strong>. Sign in with that email to accept.
              </div>
            )}
            <Button className="w-full" onClick={onAccept} disabled={busy || !state.emailMatches}>
              {busy ? "Accepting…" : "Accept invitation"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}