import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listPlatformUsers, updateUserAccess } from "@/lib/adminConsole.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

type Role = "worker" | "employer_admin" | "clinic_staff" | "pharmacy_staff" | "insurance_staff" | "platform_admin" | "super_admin";

type AccessPayload = {
  userId: string;
  role?: Role;
  approved?: boolean;
  isActive?: boolean;
  employerId?: string | null;
  clinicId?: string | null;
  pharmacyId?: string | null;
  insurerId?: string | null;
};

const ROLES: Role[] = ["worker", "employer_admin", "clinic_staff", "pharmacy_staff", "insurance_staff", "platform_admin", "super_admin"];

const MATRIX: { role: string; can: string[] }[] = [
  { role: "worker", can: ["Book appointments", "Chat with the assistant (non-diagnostic)", "Upload & read own documents", "Search medication availability"] },
  { role: "clinic_staff", can: ["See today's queue", "Manage slots", "Read patient records for own clinic", "Invite clinic teammates"] },
  { role: "employer_admin", can: ["View aggregated compliance", "Manage worker roster", "Broadcast notifications", "Export appointment CSV"] },
  { role: "pharmacy_staff", can: ["Maintain availability list (directory only)", "See lookup traffic", "Edit pharmacy profile"] },
  { role: "insurance_staff", can: ["Read aggregated network overview", "Read de-identified claims", "Export summary CSV"] },
  { role: "platform_admin", can: ["Approve staff", "Manage users, roles & organizations", "Publish announcements", "Read audit logs & settings"] },
];

function UsersPage() {
  const load = useServerFn(listPlatformUsers);
  const save = useServerFn(updateUserAccess);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("any");
  const [status, setStatus] = useState<"any" | "approved" | "pending" | "inactive">("any");
  const [editing, setEditing] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["admin-users", search, role, status], queryFn: () => load({ data: { search, role, status } }) });
  const m = useMutation({
    mutationFn: (input: AccessPayload) => save({ data: input }),
    onSuccess: () => { setErr(null); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => setErr(e.message),
  });

  const orgs = q.data?.orgs;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Users &amp; roles</h1>
          <p className="text-sm text-muted-foreground">The access-control center. Every change is written to the audit log.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowMatrix(true)}>Role permissions matrix</Button>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <input placeholder="Search name or email" className="rounded-md border bg-background p-2 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="rounded-md border bg-background p-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="any">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="rounded-md border bg-background p-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="any">Any status</option>
          <option value="approved">Active &amp; approved</option>
          <option value="pending">Awaiting approval</option>
          <option value="inactive">Deactivated</option>
        </select>
      </div>

      {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">Organization</th>
              <th className="p-3">Language</th><th className="p-3">Status</th><th className="p-3">Joined</th><th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(q.data?.users ?? []).map((u) => (
              <tr key={u.id} className="align-top">
                <td className="p-3">
                  <p className="font-medium">{u.full_name || "(no name)"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="p-3"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{u.role}</span></td>
                <td className="p-3 text-xs">{u.org ?? "—"}</td>
                <td className="p-3 text-xs uppercase">{u.preferred_language}</td>
                <td className="p-3 text-xs">
                  {!u.is_active ? <span className="text-destructive">Deactivated</span> : u.approved ? "Approved" : <span className="text-accent-foreground">Pending</span>}
                </td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {!u.approved && <Button size="sm" onClick={() => m.mutate({ userId: u.id, approved: true })} disabled={m.isPending}>Approve</Button>}
                    <Button size="sm" variant="outline" onClick={() => setEditing(editing === u.id ? null : u.id)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => m.mutate({ userId: u.id, isActive: !u.is_active })} disabled={m.isPending}>
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                  {editing === u.id && orgs && (
                    <EditRow
                      user={u}
                      orgs={orgs}
                      selfId={q.data?.selfId ?? ""}
                      pending={m.isPending}
                      onSave={(payload) => m.mutate({ userId: u.id, ...payload })}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {!q.isLoading && (q.data?.users ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">No users match these filters.</p>}
      </div>

      {showMatrix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setShowMatrix(false)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold">Role permissions matrix</h2>
            <p className="mt-1 text-xs text-muted-foreground">Capabilities are enforced by database policies, not by the UI.</p>
            <div className="mt-4 space-y-4">
              {MATRIX.map((r) => (
                <div key={r.role}>
                  <p className="text-sm font-medium">{r.role}</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                    {r.can.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <Button className="mt-5" size="sm" onClick={() => setShowMatrix(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}

type OrgLists = {
  employers: { id: string; company_name: string }[];
  clinics: { id: string; name: string }[];
  pharmacies: { id: string; name: string }[];
  insurers: { id: string; name: string }[];
};

function EditRow({
  user, orgs, selfId, pending, onSave,
}: {
  user: { id: string; role: string; employer_id: string | null; clinic_id: string | null; pharmacy_id: string | null; insurer_id: string | null; approved: boolean; is_active: boolean };
  orgs: OrgLists;
  selfId: string;
  pending: boolean;
  onSave: (payload: { role: Role; employerId: string | null; clinicId: string | null; pharmacyId: string | null; insurerId: string | null; approved: boolean }) => void;
}) {
  const [role, setRole] = useState<Role>(user.role as Role);
  const [employerId, setEmployerId] = useState(user.employer_id ?? "");
  const [clinicId, setClinicId] = useState(user.clinic_id ?? "");
  const [pharmacyId, setPharmacyId] = useState(user.pharmacy_id ?? "");
  const [insurerId, setInsurerId] = useState(user.insurer_id ?? "");
  const [approved, setApproved] = useState(user.approved);
  const isSelf = user.id === selfId;

  return (
    <div className="mt-3 w-72 space-y-2 rounded-xl border bg-background p-3">
      <select className="w-full rounded-md border bg-background p-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {role === "employer_admin" && (
        <select className="w-full rounded-md border bg-background p-2 text-sm" value={employerId} onChange={(e) => setEmployerId(e.target.value)}>
          <option value="">Link an employer…</option>
          {orgs.employers.map((o) => <option key={o.id} value={o.id}>{o.company_name}</option>)}
        </select>
      )}
      {role === "clinic_staff" && (
        <select className="w-full rounded-md border bg-background p-2 text-sm" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
          <option value="">Link a clinic…</option>
          {orgs.clinics.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
      {role === "pharmacy_staff" && (
        <select className="w-full rounded-md border bg-background p-2 text-sm" value={pharmacyId} onChange={(e) => setPharmacyId(e.target.value)}>
          <option value="">Link a pharmacy…</option>
          {orgs.pharmacies.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
      {role === "insurance_staff" && (
        <select className="w-full rounded-md border bg-background p-2 text-sm" value={insurerId} onChange={(e) => setInsurerId(e.target.value)}>
          <option value="">Link an insurer…</option>
          {orgs.insurers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} /> Approved
      </label>
      {isSelf && <p className="text-xs text-muted-foreground">You cannot remove your own admin role.</p>}
      <Button
        size="sm"
        disabled={pending}
        onClick={() => onSave({
          role,
          employerId: role === "employer_admin" ? employerId || null : null,
          clinicId: role === "clinic_staff" ? clinicId || null : null,
          pharmacyId: role === "pharmacy_staff" ? pharmacyId || null : null,
          insurerId: role === "insurance_staff" ? insurerId || null : null,
          approved,
        })}
      >
        Save changes
      </Button>
    </div>
  );
}