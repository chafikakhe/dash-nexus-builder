import { supabase } from "./supabase";

export type LogInput = {
  orgId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  metadata?: Record<string, unknown>;
};

/** Fire-and-forget activity logger. Never throws. */
export async function logActivity(input: LogInput) {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("activity_log").insert({
      org_id: input.orgId,
      actor_id: u.user.id,
      actor_email: u.user.email,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      target_label: input.targetLabel ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (e) {
    console.warn("[activity] log failed", e);
  }
}
