import { createFileRoute } from "@tanstack/react-router";

const TOKEN = "tmp-2f9a41c7d8e64b0a";

const EMP = "d0000000-0000-4000-8000-000000000001";
const CLINIC = "d0000000-0000-4000-8000-000000000002";
const PHARM = "d0000000-0000-4000-8000-000000000003";
const INS = "d0000000-0000-4000-8000-000000000004";

type Demo = {
  email: string; name: string; role: string; lang: string;
  employer_id?: string; clinic_id?: string; pharmacy_id?: string; insurer_id?: string;
};

const DEMOS: Demo[] = [
  { email: "admin@sihha.qa", name: "Sihha Platform Admin", role: "platform_admin", lang: "en" },
  { email: "suman@worker.sihha.qa", name: "Suman Tamang", role: "worker", lang: "ne", employer_id: EMP },
  { email: "fatima@alwathba.qa", name: "Fatima Al Wathba", role: "employer_admin", lang: "ar", employer_id: EMP },
  { email: "desk@alrayyanclinic.qa", name: "Al Rayyan Front Desk", role: "clinic_staff", lang: "en", clinic_id: CLINIC },
  { email: "anjali@alnasrpharmacy.qa", name: "Anjali Nair", role: "pharmacy_staff", lang: "en", pharmacy_id: PHARM },
  { email: "khalid@qlm.qa", name: "Khalid Al Marri", role: "insurance_staff", lang: "ar", insurer_id: INS },
];

export const Route = createFileRoute("/api/public/seed-demo-tmp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-seed-token") !== TOKEN) return new Response("no", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const out: unknown[] = [];
        for (const d of DEMOS) {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          let user = list?.users.find((u) => u.email === d.email);
          if (!user) {
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
              email: d.email,
              password: "SihhaDemo#2026",
              email_confirm: true,
              user_metadata: { full_name: d.name, preferred_language: d.lang },
            });
            if (error) { out.push({ email: d.email, error: error.message }); continue; }
            user = data.user!;
          } else {
            await supabaseAdmin.auth.admin.updateUserById(user.id, { password: "SihhaDemo#2026", email_confirm: true });
          }
          await supabaseAdmin.from("profiles").upsert({
            id: user.id, full_name: d.name, email: d.email,
            preferred_language: d.lang as never, approved: true, is_active: true,
            employer_id: d.employer_id ?? null, clinic_id: d.clinic_id ?? null,
            pharmacy_id: d.pharmacy_id ?? null, insurer_id: d.insurer_id ?? null,
            consent_accepted_at: new Date().toISOString(),
          } as never);
          const { data: existing } = await supabaseAdmin
            .from("user_roles").select("id").eq("user_id", user.id).eq("role", d.role as never).maybeSingle();
          if (!existing) {
            await supabaseAdmin.from("user_roles").insert({
              user_id: user.id, role: d.role as never,
              employer_id: d.employer_id ?? null, clinic_id: d.clinic_id ?? null,
              pharmacy_id: d.pharmacy_id ?? null, insurer_id: d.insurer_id ?? null,
            } as never);
          }
          if (d.role === "clinic_staff") {
            await supabaseAdmin.from("clinic_staff_permissions").upsert({
              user_id: user.id, clinic_id: CLINIC,
              can_view_queue: true, can_edit_slots: true, can_add_documents: true, can_manage_staff: true,
            } as never);
          }
          out.push({ email: d.email, id: user.id, role: d.role });
        }
        return Response.json({ seeded: out });
      },
    },
  },
});
