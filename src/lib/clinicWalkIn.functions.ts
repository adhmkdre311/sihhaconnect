// M5: clinic staff create an appointment for a worker standing at the desk.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type MinimalClient = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (a: string, b: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: { clinic_id: string | null } | null }> } };
    };
  };
};

async function myClinicId(supabase: MinimalClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from("user_roles").select("clinic_id")
    .eq("user_id", userId).eq("role", "clinic_staff").maybeSingle();
  if (!data?.clinic_id) throw new Error("Your account is not linked to a clinic");
  return data.clinic_id;
}

export const findWalkInWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().trim().min(4).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    // Only staff attached to a clinic may search the worker directory.
    await myClinicId(context.supabase as unknown as MinimalClient, context.userId);
    const { findWorkerByContact } = await import("@/lib/clinicWalkIn.server");
    return findWorkerByContact(data.query);
  });

export const createWalkInAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      workerId: z.string().uuid(),
      department: z.string().trim().min(2).max(60),
      reason: z.enum(["fever", "injury", "dental", "checkup", "medication_review", "other"]).optional(),
      note: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clinicId = await myClinicId(supabase as unknown as MinimalClient, userId);

    const { data: appt, error } = await supabase
      .from("appointments")
      .insert({
        worker_id: data.workerId,
        clinic_id: clinicId,
        department: data.department,
        scheduled_at: new Date().toISOString(),
        status: "awaiting_checkin",
        reason: data.reason ?? "other",
        context_note: data.note?.length ? data.note : null,
        worker_notes: "Walk-in registered at the clinic front desk.",
      })
      .select("id")
      .single();
    if (error || !appt) throw new Error(error?.message ?? "Could not register the walk-in");

    await supabase.from("notifications").insert({
      worker_id: data.workerId,
      type: "appointment_reminder",
      channel: "in_app",
      title: "Walk-in visit registered",
      content: `The clinic registered your walk-in visit for ${data.department}. Please wait to be called.`,
    });

    return { ok: true, appointmentId: appt.id };
  });
