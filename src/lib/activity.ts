import {
  Activity,
  Bell,
  Building2,
  Database,
  LayoutDashboard,
  Settings2,
  Trash2,
  UserCog,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ActivityLogModernRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  target_type: string | null;
  target_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ActivityLogLegacyRow = {
  id: string;
  org_id: string;
  user_id: string | null;
  actor_name: string | null;
  action: string;
  resource_type: string | null;
  resource_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type WorkspaceActivityEvent = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  target_type: string;
  target_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type LogWorkspaceActivityInput = {
  workspaceId: string;
  action: string;
  targetType: string;
  targetName?: string | null;
  metadata?: Record<string, unknown>;
};

export function formatActivityError(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Unknown activity error.";
  }

  const maybeError = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };

  return [
    maybeError.code ? `[${maybeError.code}]` : null,
    maybeError.message ?? "Activity query failed.",
    maybeError.details ? `Details: ${maybeError.details}` : null,
    maybeError.hint ? `Hint: ${maybeError.hint}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function logWorkspaceActivity({
  workspaceId,
  action,
  targetType,
  targetName = null,
  metadata = {},
}: LogWorkspaceActivityInput) {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      console.error("[activity] Cannot log workspace activity without an authenticated user.");
      return null;
    }

    const userName =
      typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()
        ? user.user_metadata.display_name.trim()
        : user.email ?? "Unknown";

    const modernInsert = await supabase.from("activity_log").insert({
      workspace_id: workspaceId,
      org_id: workspaceId,
      user_id: user.id,
      user_name: userName,
      actor_name: userName,
      action,
      target_type: targetType,
      resource_type: targetType,
      target_name: targetName,
      resource_name: targetName,
      metadata,
    });

    if (!modernInsert.error) {
      return true;
    }

    if (!isMissingColumnError(modernInsert.error)) {
      console.error("[activity] Failed to log workspace activity:", modernInsert.error);
      return null;
    }

    const legacyInsert = await supabase.from("activity_log").insert({
      org_id: workspaceId,
      user_id: user.id,
      actor_name: userName,
      action,
      resource_type: targetType,
      resource_name: targetName,
      metadata,
    });

    if (legacyInsert.error) {
      console.error("[activity] Failed to log workspace activity via legacy columns:", legacyInsert.error);
      return null;
    }

    return true;
  } catch (error) {
    console.error("[activity] Unexpected activity logging error:", error);
    return null;
  }
}

export async function fetchWorkspaceActivity(workspaceId: string, limit = 100) {
  const modernResult = await supabase
    .from("activity_log")
    .select("id, workspace_id, user_id, user_name, action, target_type, target_name, metadata, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!modernResult.error) {
    return (modernResult.data ?? []).map(mapModernRow);
  }

  if (!isMissingColumnError(modernResult.error)) {
    throw modernResult.error;
  }

  const legacyResult = await supabase
    .from("activity_log")
    .select("id, org_id, user_id, actor_name, action, resource_type, resource_name, metadata, created_at")
    .eq("org_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return (legacyResult.data ?? []).map(mapLegacyRow);
}

export function describeWorkspaceActivity(event: WorkspaceActivityEvent) {
  const target = event.target_name?.trim() ? event.target_name : fallbackTargetName(event);

  switch (event.action) {
    case "workspace_created":
      return `created workspace ${target ?? "workspace"}`;
    case "workspace_deleted":
      return `deleted workspace ${target ?? "workspace"}`;
    case "dashboard_created":
      return `created dashboard ${target ?? "dashboard"}`;
    case "dashboard_updated":
      return `updated dashboard ${target ?? "dashboard"}`;
    case "dashboard_deleted":
      return `deleted dashboard ${target ?? "dashboard"}`;
    case "collection_created":
      return `created collection ${target ?? "collection"}`;
    case "collection_updated":
      return `updated collection ${target ?? "collection"}`;
    case "collection_deleted":
      return `deleted collection ${target ?? "collection"}`;
    case "member_invited":
      return `invited member ${target ?? "member"}`;
    case "member_removed":
      return `removed member ${target ?? "member"}`;
    case "role_changed":
      return `changed role for ${target ?? "member"}${typeof event.metadata.next_role === "string" ? ` to ${event.metadata.next_role}` : ""}`;
    case "settings_updated":
      return `changed ${target ?? "settings"}`;
    case "api_token_created":
      return `created API token ${target ?? ""}`.trim();
    default:
      return `${event.action.replaceAll("_", " ")}${target ? ` ${target}` : ""}`;
  }
}

export function getWorkspaceActivityIcon(event: WorkspaceActivityEvent): LucideIcon {
  switch (event.action) {
    case "workspace_created":
    case "workspace_deleted":
      return Building2;
    case "dashboard_created":
    case "dashboard_updated":
    case "dashboard_deleted":
      return event.action === "dashboard_deleted" ? Trash2 : LayoutDashboard;
    case "collection_created":
    case "collection_updated":
    case "collection_deleted":
      return event.action === "collection_deleted" ? Trash2 : Database;
    case "member_invited":
      return UserPlus;
    case "member_removed":
    case "role_changed":
      return UserCog;
    case "settings_updated":
      return Settings2;
    case "api_token_created":
      return Bell;
    default:
      return Activity;
  }
}

function isMissingColumnError(error: { message?: string; details?: string; code?: string }) {
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return text.includes("column") && (text.includes("workspace_id") || text.includes("user_name") || text.includes("target_type") || text.includes("target_name"));
}

function mapModernRow(row: ActivityLogModernRow): WorkspaceActivityEvent {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    user_name: row.user_name ?? "Unknown",
    action: row.action,
    target_type: row.target_type ?? "workspace",
    target_name: row.target_name,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
  };
}

function mapLegacyRow(row: ActivityLogLegacyRow): WorkspaceActivityEvent {
  return {
    id: row.id,
    workspace_id: row.org_id,
    user_id: row.user_id,
    user_name: row.actor_name ?? "Unknown",
    action: row.action,
    target_type: row.resource_type ?? "workspace",
    target_name: row.resource_name,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
  };
}

function fallbackTargetName(event: WorkspaceActivityEvent) {
  if (typeof event.metadata.target_name === "string" && event.metadata.target_name.trim()) {
    return event.metadata.target_name;
  }

  if (typeof event.metadata.workspace_name === "string" && event.metadata.workspace_name.trim()) {
    return event.metadata.workspace_name;
  }

  return null;
}
