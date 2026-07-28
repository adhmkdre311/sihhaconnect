import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyClinicPerms } from "@/lib/clinicStaff.functions";

export type ClinicPerms = {
  can_view_queue: boolean;
  can_edit_slots: boolean;
  can_add_documents: boolean;
  can_manage_staff: boolean;
};

export function useClinicPerms() {
  const get = useServerFn(getMyClinicPerms);
  const [perms, setPerms] = useState<ClinicPerms | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void get().then((r) => {
      if (!alive) return;
      setPerms(r ? {
        can_view_queue: r.can_view_queue,
        can_edit_slots: r.can_edit_slots,
        can_add_documents: r.can_add_documents,
        can_manage_staff: r.can_manage_staff,
      } : null);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { alive = false; };
  }, []);
  return { perms, loading };
}