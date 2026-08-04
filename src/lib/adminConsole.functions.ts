import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPlatformAdmin, audit, weekKey, lastWeeks, filterRows, nameMap } from "@/lib/adminConsole.server";

// ---------- G1: Dashboard ----------

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertPlatformAdmin(context.userId);
    const head = (t: "profiles" | "employers" | "clinics" | "pharmacies" | "insurers" | "appointments" | "documents" | "medication_availability") =>
      db.from(t).select("*", { count: "exact", head: true });
    const [users, employers, clinics, pharmacies, insurers, appointments, documents, listings] = await Promise.all([
      head("profiles"), head("employers"), head("clinics"), head("pharmacies"),
      head("insurers"), head("appointments"), head("documents"), head("medication_availability"),
    ]);
    const { data: pending } = await db
      .from("profiles")
      .select("id, full_name, email, created_at, preferred_language")
      .eq("approved", false)
      .order("created_at", { ascending: true })
      .limit(20);
    const pendingIds = (pending ?? []).map((p) => p.id);
    const { data: pendingRoles } = pendingIds.length
      ? await db.from("user_roles").select("user_id, role").in("user_id", pendingIds)
      : { data: [] as { user_id: string; role: string }[] };
    const { data: requests } = await db
      .from("role_requests")
      .select("id, user_id, role, company_name, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20);
    const { data: activity } = await db
      .from("audit_logs")
      .select("id, action, table_name, record_id, actor_id, created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    const actorIds = Array.from(new Set((activity ?? []).map((a) => a.actor_id).filter(Boolean) as string[]));
    const { data: actors } = actorIds.length
      ? await db.from("profiles").select("id, full_name, email").in("id", actorIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const actorMap = new Map((actors ?? []).map((a) => [a.id, a.full_name || a.email || "—"]));
    const roleMap = new Map((pendingRoles ?? []).map((r) => [r.user_id, r.role]));
    return {
      counts: {
        users: users.count ?? 0, employers: employers.count ?? 0, clinics: clinics.count ?? 0,
        pharmacies: pharmacies.count ?? 0, insurers: insurers.count ?? 0,
        appointments: appointments.count ?? 0, documents: documents.count ?? 0, listings: listings.count ?? 0,
      },
      awaiting: (pending ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null })),
      requests: requests ?? [],
      activity: (activity ?? []).map((a) => ({ ...a, actor: actorMap.get(a.actor_id ?? "") ?? "system" })),
    };
  });

// ---------- G2: Users & roles ----------

export const listPlatformUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      search: z.string().max(120).optional(),
      role: z.string().max(40).default("any"),
      status: z.enum(["any", "approved", "pending", "inactive"]).default("any"),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const db = await assertPlatformAdmin(context.userId);
    let q = db
      .from("profiles")
      .select("id, full_name, email, phone_number, preferred_language, approved, is_active, created_at, employer_id, clinic_id, pharmacy_id, insurer_id")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.search) q = q.or(`full_name.ilike.%${data.search}%,email.ilike.%${data.search}%`);
    if (data.status === "approved") q = q.eq("approved", true).eq("is_active", true);
    if (data.status === "pending") q = q.eq("approved", false);
    if (data.status === "inactive") q = q.eq("is_active", false);
    const [{ data: rows }, { data: roles }, { data: employers }, { data: clinics }, { data: pharmacies }, { data: insurers }] = await Promise.all([
      q,
      db.from("user_roles").select("user_id, role, employer_id, clinic_id, pharmacy_id, insurer_id"),
      db.from("employers").select("id, company_name").order("company_name"),
      db.from("clinics").select("id, name").order("name"),
      db.from("pharmacies").select("id, name").order("name"),
      db.from("insurers").select("id, name").order("name"),
    ]);
    const roleByUser = new Map<string, string>();
    for (const r of roles ?? []) if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role);
    const orgName = (id: string | null, list: { id: string; name?: string; company_name?: string }[]) =>
      id ? (list.find((o) => o.id === id)?.name ?? list.find((o) => o.id === id)?.company_name ?? null) : null;
    const users = (rows ?? [])
      .map((p) => ({
        ...p,
        role: roleByUser.get(p.id) ?? "worker",
        org:
          orgName(p.employer_id, employers ?? []) ??
          orgName(p.clinic_id, clinics ?? []) ??
          orgName(p.pharmacy_id, pharmacies ?? []) ??
          orgName(p.insurer_id, insurers ?? []),
      }))
      .filter((p) => data.role === "any" || p.role === data.role);
    return {
      users,
      orgs: { employers: employers ?? [], clinics: clinics ?? [], pharmacies: pharmacies ?? [], insurers: insurers ?? [] },
      selfId: context.userId,
    };
  });

export const updateUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["worker", "employer_admin", "clinic_staff", "pharmacy_staff", "insurance_staff", "platform_admin", "super_admin"]).optional(),
      employerId: z.string().uuid().nullable().optional(),
      clinicId: z.string().uuid().nullable().optional(),
      pharmacyId: z.string().uuid().nullable().optional(),
      insurerId: z.string().uuid().nullable().optional(),
      approved: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await assertPlatformAdmin(context.userId);
    const { data: before } = await db
      .from("profiles")
      .select("approved, is_active, employer_id, clinic_id, pharmacy_id, insurer_id")
      .eq("id", data.userId)
      .maybeSingle();

    if (data.role) {
      if (data.userId === context.userId && data.role !== "platform_admin" && data.role !== "super_admin") {
        throw new Error("You cannot remove your own admin role");
      }
      const need: Record<string, string | null | undefined> = {
        employer_admin: data.employerId, clinic_staff: data.clinicId,
        pharmacy_staff: data.pharmacyId, insurance_staff: data.insurerId,
      };
      if (data.role in need && !need[data.role]) throw new Error(`Select an organisation for the ${data.role} role`);
      await db.from("user_roles").delete().eq("user_id", data.userId);
      const { error } = await db.from("user_roles").insert({
        user_id: data.userId, role: data.role,
        employer_id: data.employerId ?? null, clinic_id: data.clinicId ?? null,
        pharmacy_id: data.pharmacyId ?? null, insurer_id: data.insurerId ?? null,
      });
      if (error) throw new Error(error.message);
    }

    const patch: Record<string, unknown> = {};
    if (data.approved !== undefined) patch.approved = data.approved;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (data.employerId !== undefined) patch.employer_id = data.employerId;
    if (data.clinicId !== undefined) patch.clinic_id = data.clinicId;
    if (data.pharmacyId !== undefined) patch.pharmacy_id = data.pharmacyId;
    if (data.insurerId !== undefined) patch.insurer_id = data.insurerId;
    if (Object.keys(patch).length) {
      const { error } = await db.from("profiles").update(patch as never).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }
    await audit(db, context.userId, "ADMIN_UPDATE_ACCESS", "profiles", data.userId, { old: before ?? null, new: { ...patch, role: data.role ?? null } });
    return { ok: true };
  });

// ---------- G3: Organisations ----------

export const listAllOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertPlatformAdmin(context.userId);
    const [{ data: employers }, { data: clinics }, { data: pharmacies }, { data: insurers }, { data: links }] = await Promise.all([
      db.from("employers").select("id, company_name, industry, contact_email, invite_code, worker_count, subscription_tier, created_at").order("company_name"),
      db.from("clinics").select("id, name, address, phone, lat, lng, departments, languages_supported_onsite, created_at").order("name"),
      db.from("pharmacies").select("id, name, area, address, phone, hours, lat, lng, created_at").order("name"),
      db.from("insurers").select("id, name, created_at").order("name"),
      db.from("insurer_employer_scope").select("insurer_id, employer_id"),
    ]);
    return { employers: employers ?? [], clinics: clinics ?? [], pharmacies: pharmacies ?? [], insurers: insurers ?? [], links: links ?? [] };
  });

export const saveOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      kind: z.enum(["employers", "clinics", "pharmacies", "insurers"]),
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1, "Name is required").max(160),
      address: z.string().max(300).optional(),
      phone: z.string().max(40).optional(),
      area: z.string().max(120).optional(),
      hours: z.string().max(160).optional(),
      industry: z.string().max(120).optional(),
      contactEmail: z.string().email().optional().or(z.literal("")),
      lat: z.number().finite().nullable().optional(),
      lng: z.number().finite().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await assertPlatformAdmin(context.userId);
    let payload: Record<string, unknown>;
    if (data.kind === "employers") {
      payload = { company_name: data.name, industry: data.industry || null, contact_email: data.contactEmail || null };
    } else if (data.kind === "clinics") {
      payload = { name: data.name, address: data.address || null, phone: data.phone || null, lat: data.lat ?? null, lng: data.lng ?? null };
    } else if (data.kind === "pharmacies") {
      payload = { name: data.name, area: data.area || null, address: data.address || null, phone: data.phone || null, hours: data.hours || null, lat: data.lat ?? null, lng: data.lng ?? null };
    } else {
      payload = { name: data.name };
    }
    if (data.id) {
      const { error } = await db.from(data.kind).update(payload as never).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(db, context.userId, "ADMIN_UPDATE_ORG", data.kind, data.id, { new: payload });
      return { id: data.id };
    }
    const { data: row, error } = await db.from(data.kind).insert(payload as never).select("id").single();
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "ADMIN_CREATE_ORG", data.kind, row!.id, { new: payload });
    return { id: row!.id };
  });

export const deleteOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ kind: z.enum(["employers", "clinics", "pharmacies", "insurers"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await assertPlatformAdmin(context.userId);
    const { error } = await db.from(data.kind).delete().eq("id", data.id);
    if (error) throw new Error(error.message.includes("foreign key") ? "This organisation still has linked records." : error.message);
    await audit(db, context.userId, "ADMIN_DELETE_ORG", data.kind, data.id, {});
    return { ok: true };
  });

export const saveOrgLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ insurerId: z.string().uuid(), employerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertPlatformAdmin(context.userId);
    const { data: existing } = await db
      .from("insurer_employer_scope").select("insurer_id")
      .eq("insurer_id", data.insurerId).eq("employer_id", data.employerId).maybeSingle();
    if (existing) throw new Error("That insurer is already linked to this employer group.");
    const { error } = await db.from("insurer_employer_scope").insert({ insurer_id: data.insurerId, employer_id: data.employerId });
    if (error) throw new Error("That insurer is already linked to this employer group.");
    await audit(db, context.userId, "ADMIN_LINK_INSURER", "insurer_employer_scope", null, { new: data });
    return { ok: true };
  });

export const deleteOrgLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ insurerId: z.string().uuid(), employerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertPlatformAdmin(context.userId);
    const { error } = await db.from("insurer_employer_scope").delete()
      .eq("insurer_id", data.insurerId).eq("employer_id", data.employerId);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "ADMIN_UNLINK_INSURER", "insurer_employer_scope", null, { old: data });
    return { ok: true };
  });

// ---------- G4: Content push ----------

export const pushBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(1000),
      audience: z.enum(["all_workers", "all_staff"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await assertPlatformAdmin(context.userId);
    const { data: count, error } = await context.supabase.rpc("send_broadcast", {
      _title: data.title, _body: data.body, _category: "advisory", _audience: data.audience,
    });
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "ADMIN_PUSH_BROADCAST", "notifications", null, { new: { audience: data.audience, title: data.title, recipients: count } });
    return { recipients: (count as number) ?? 0 };
  });

// ---------- G5: Data records ----------

export const listAdminRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      table: z.enum(["appointments", "documents", "medication_availability", "notifications"]),
      search: z.string().max(120).optional(),
      status: z.string().max(40).default("any"),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const db = await assertPlatformAdmin(context.userId);
    if (data.table === "appointments") {
      let q = db.from("appointments")
        .select("id, scheduled_at, status, department, worker_id, clinic_id")
        .order("scheduled_at", { ascending: false }).limit(300);
      if (data.status !== "any") q = q.eq("status", data.status as never);
      const [{ data: rows, error }, { data: clinics }] = await Promise.all([q, db.from("clinics").select("id, name")]);
      if (error) throw new Error(error.message);
      const workers = await nameMap(db, (rows ?? []).map((r) => r.worker_id));
      const clinicMap = new Map((clinics ?? []).map((c) => [c.id, c.name]));
      return filterRows((rows ?? []).map((r) => ({
        id: r.id, when: r.scheduled_at, status: r.status,
        a: workers.get(r.worker_id) ?? "—", b: clinicMap.get(r.clinic_id) ?? "—", c: r.department,
      })), data.search);
    }
    if (data.table === "documents") {
      let q = db.from("documents")
        .select("id, created_at, type, flagged_for_human_review, worker_id")
        .order("created_at", { ascending: false }).limit(300);
      if (data.status === "flagged") q = q.eq("flagged_for_human_review", true);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      const workers = await nameMap(db, (rows ?? []).map((r) => r.worker_id));
      return filterRows((rows ?? []).map((r) => ({
        id: r.id, when: r.created_at, status: r.flagged_for_human_review ? "flagged" : "ok",
        a: workers.get(r.worker_id) ?? "—", b: r.type, c: "",
      })), data.search);
    }
    if (data.table === "medication_availability") {
      let q = db.from("medication_availability")
        .select("id, updated_at, medication_name, in_stock, pharmacy_id")
        .order("updated_at", { ascending: false }).limit(500);
      if (data.status === "in_stock") q = q.eq("in_stock", true);
      if (data.status === "out_of_stock") q = q.eq("in_stock", false);
      const [{ data: rows, error }, { data: pharmacies }] = await Promise.all([q, db.from("pharmacies").select("id, name")]);
      if (error) throw new Error(error.message);
      const pmap = new Map((pharmacies ?? []).map((p) => [p.id, p.name]));
      return filterRows((rows ?? []).map((r) => ({
        id: r.id, when: r.updated_at, status: r.in_stock ? "in stock" : "out of stock",
        a: r.medication_name, b: pmap.get(r.pharmacy_id) ?? "—", c: "",
      })), data.search);
    }
    let q = db.from("notifications")
      .select("id, sent_at, title, content, type, read_at, worker_id")
      .order("sent_at", { ascending: false }).limit(300);
    if (data.status === "unread") q = q.is("read_at", null);
    if (data.status === "read") q = q.not("read_at", "is", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const workers = await nameMap(db, (rows ?? []).map((r) => r.worker_id).filter(Boolean) as string[]);
    return filterRows((rows ?? []).map((r) => ({
      id: r.id, when: r.sent_at, status: r.read_at ? "read" : "unread",
      a: (r.worker_id ? workers.get(r.worker_id) : null) ?? "—",
      b: r.title ?? r.type, c: r.content.slice(0, 80),
    })), data.search);
  });

export const deleteAdminRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      table: z.enum(["appointments", "documents", "medication_availability", "notifications"]),
      id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await assertPlatformAdmin(context.userId);
    const { error } = await db.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "ADMIN_DELETE_RECORD", data.table, data.id, {});
    return { ok: true };
  });

// ---------- G6: Analytics ----------

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertPlatformAdmin(context.userId);
    const since12 = new Date(Date.now() - 84 * 864e5).toISOString();
    const since8 = new Date(Date.now() - 56 * 864e5).toISOString();
    const [{ data: profiles }, { data: appts }, { data: roles }, { data: lookups }] = await Promise.all([
      db.from("profiles").select("created_at").gte("created_at", since12).limit(5000),
      db.from("appointments").select("status, created_at").limit(5000),
      db.from("user_roles").select("role").limit(5000),
      db.from("availability_lookup_events").select("created_at").gte("created_at", since8).limit(5000),
    ]);
    const bucket = (rows: { created_at: string }[], weeks: string[]) => {
      const m = new Map(weeks.map((w) => [w, 0]));
      for (const r of rows) {
        const k = weekKey(r.created_at);
        if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
      }
      return weeks.map((w) => ({ week: w.slice(5), count: m.get(w) ?? 0 }));
    };
    const statusCounts = new Map<string, number>();
    for (const a of appts ?? []) statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
    const roleCounts = new Map<string, number>();
    for (const r of roles ?? []) roleCounts.set(r.role, (roleCounts.get(r.role) ?? 0) + 1);
    return {
      cards: {
        signups12w: (profiles ?? []).length,
        appointments: (appts ?? []).length,
        completionRate: (appts ?? []).length
          ? Math.round(((statusCounts.get("completed") ?? 0) / (appts ?? []).length) * 100)
          : 0,
        lookups8w: (lookups ?? []).length,
      },
      signupsPerWeek: bucket(profiles ?? [], lastWeeks(12)),
      appointmentsByStatus: Array.from(statusCounts, ([name, value]) => ({ name, value })),
      usersByRole: Array.from(roleCounts, ([name, value]) => ({ name, value })),
      lookupsPerWeek: bucket(lookups ?? [], lastWeeks(8)),
    };
  });

// ---------- G7: Audit logs ----------

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      search: z.string().max(120).optional(),
      action: z.string().max(60).default("any"),
      table: z.string().max(60).default("any"),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const db = await assertPlatformAdmin(context.userId);
    let q = db.from("audit_logs")
      .select("id, created_at, action, table_name, record_id, actor_id, detail")
      .order("created_at", { ascending: false }).limit(300);
    if (data.action !== "any") q = q.eq("action", data.action);
    if (data.table !== "any") q = q.eq("table_name", data.table);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean) as string[]));
    const { data: actors } = ids.length
      ? await db.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const map = new Map((actors ?? []).map((a) => [a.id, a.full_name || a.email || "—"]));
    const withActor = (rows ?? []).map((r) => ({ ...r, actor: r.actor_id ? map.get(r.actor_id) ?? "—" : "system" }));
    const term = data.search?.trim().toLowerCase();
    const logs = term
      ? withActor.filter((r) => `${r.actor} ${r.action} ${r.table_name ?? ""} ${JSON.stringify(r.detail ?? {})}`.toLowerCase().includes(term))
      : withActor;
    return {
      logs,
      actions: Array.from(new Set(withActor.map((r) => r.action))).sort(),
      tables: Array.from(new Set(withActor.map((r) => r.table_name).filter(Boolean) as string[])).sort(),
    };
  });

// ---------- G8: Settings ----------

export const listPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertPlatformAdmin(context.userId);
    const { data, error } = await db.from("platform_settings").select("key, value, updated_at").order("key");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updatePlatformSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().min(1).max(80), value: z.unknown() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertPlatformAdmin(context.userId);
    const { data: before } = await db.from("platform_settings").select("value").eq("key", data.key).maybeSingle();
    const { error } = await db.from("platform_settings")
      .upsert({ key: data.key, value: data.value as never, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "ADMIN_UPDATE_SETTING", "platform_settings", null, { old: before?.value ?? null, new: data.value });
    return { ok: true };
  });