import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { requestStaffRole } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { SihhaLockup } from "@/components/SihhaLogo";
import { toast } from "sonner";

type StaffRole = "pharmacy_staff" | "insurance_staff";

function parseRole(v: unknown): StaffRole {
  return v === "insurance_staff" ? "insurance_staff" : "pharmacy_staff";
}

export const Route = createFileRoute("/staff-signup")({
  validateSearch: (s: Record<string, unknown>) => ({ role: parseRole(s.role) }),
  component: StaffSignup,
});

function StaffSignup() {
  const { role } = Route.useSearch();
  const { user, refreshRoles } = useAuth();
  const nav = useNavigate();
  const submitRole = useServerFn(requestStaffRole);

  const [mode, setMode] = useState<"signup" | "login">(user ? "login" : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  const isPharm = role === "pharmacy_staff";
  const orgLabel = isPharm ? "Pharmacy" : "Insurer";

  useEffect(() => {
    const table = isPharm ? "pharmacies" : "insurers";
    void supabase.from(table).select("id, name").order("name").then(({ data }) => setOrgs(data ?? []));
  }, [isPharm]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      if (!user) {
        if (mode === "signup") {
          const { error: e1 } = await supabase.auth.signUp({
            email, password,
            options: {
              emailRedirectTo: `${window.location.origin}/staff-signup?role=${role}`,
              data: { full_name: fullName, pending_role: role, pending_org_id: orgId },
            },
          });
          if (e1) throw e1;
          toast.info("Check your email to confirm your account, then continue here.");
          setBusy(false);
          return;
        }
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (e2) throw e2;
        await refreshRoles();
      }
      if (!orgId) {
        setError(`Please select your ${orgLabel.toLowerCase()}.`);
        setBusy(false);
        return;
      }
      await submitRole({
        data: {
          role,
          fullName: fullName || (user?.user_metadata?.full_name as string) || "Staff",
          pharmacyId: isPharm ? orgId : undefined,
          insurerId: isPharm ? undefined : orgId,
        },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background p-4">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-4 flex items-center justify-between">
          <Link to="/" className="text-sm text-primary underline">← Home</Link>
          <SihhaLockup size="sm" />
        </header>
        <main className="rounded-2xl border bg-card p-6 shadow-sm">
          {done ? (
            <div className="space-y-3 text-center">
              <h1 className="font-display text-xl font-semibold">Request submitted</h1>
              <p className="text-sm text-muted-foreground">
                Your {orgLabel.toLowerCase()} staff request is pending review by a Sihha platform administrator.
                You'll receive access once approved.
              </p>
              <Button variant="ghost" className="w-full" onClick={() => nav({ to: "/" })}>Back to home</Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-xl font-semibold">{orgLabel} staff sign-up</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {isPharm
                  ? "Sihha lists availability only — no orders, no delivery, no prices."
                  : "Sihha shares aggregated per-employer metrics only. No patient-level data."}
              </p>

              {!user && (
                <div role="group" className="my-4 flex rounded-lg border p-1 text-sm">
                  <button type="button" onClick={() => setMode("signup")} aria-pressed={mode === "signup"}
                    className={`flex-1 rounded-md px-3 py-1.5 ${mode === "signup" ? "bg-primary text-primary-foreground" : ""}`}>Create account</button>
                  <button type="button" onClick={() => setMode("login")} aria-pressed={mode === "login"}
                    className={`flex-1 rounded-md px-3 py-1.5 ${mode === "login" ? "bg-primary text-primary-foreground" : ""}`}>Log in</button>
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-3">
                {!user && mode === "signup" && (
                  <Field label="Full name" name="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                )}
                {!user && (
                  <>
                    <Field label="Email" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Field label="Password" type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
                  </>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="org">Your {orgLabel.toLowerCase()}</Label>
                  <select id="org" value={orgId} onChange={(e) => setOrgId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                    <option value="" disabled>Choose your {orgLabel.toLowerCase()}…</option>
                    {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  {orgs.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No {orgLabel.toLowerCase()}s registered yet. Contact a Sihha platform administrator to add yours.
                    </p>
                  )}
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Working…" : user ? "Request access" : mode === "signup" ? "Create account & request access" : "Log in & request access"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Requests are reviewed manually by Sihha. You'll get an email once approved.
                </p>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}