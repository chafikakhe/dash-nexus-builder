import { supabase } from "@/lib/supabase";

export type CollectionSchemaField = {
  name: string;
  type: string;
  required?: boolean;
  config?: unknown;
};

type InsertCollectionArgs = {
  orgId: string;
  userId: string;
  name: string;
  schema?: CollectionSchemaField[];
  source?: "collections" | "import";
};

type CollectionInsertRow = {
  id: string;
  org_id: string;
  name: string;
  schema: CollectionSchemaField[] | null;
  created_at: string;
  created_by?: string | null;
};

export async function insertCollectionWithAccessCheck({
  orgId,
  userId,
  name,
  schema = [],
  source = "collections",
}: InsertCollectionArgs): Promise<CollectionInsertRow> {
  const { data: membership, error: membershipError } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    console.error(`[${source}] membership check error`, membershipError);
    throw new Error(`Failed to verify workspace membership: ${membershipError.message}`);
  }

  if (!membership) {
    throw new Error("You don't have access to this workspace");
  }

  if (!["owner", "admin"].includes(membership.role)) {
    throw new Error("Only workspace owners or admins can create collections");
  }

  const insertPayload = {
    org_id: orgId,
    name,
    schema,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  if (source === "import") {
    console.log("import collection payload", insertPayload);
  } else {
    console.debug("[collections] Insert payload:", insertPayload);
  }

  const { data, error } = await supabase
    .from("collections")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    console.error(`[${source}] Insert error:`, error.code, error.message, error);
    console.error(`[${source}] Insert payload that failed:`, insertPayload);
    throw new Error(error.message);
  }

  return {
    ...(data as CollectionInsertRow),
    schema: ((data as CollectionInsertRow).schema ?? []) as CollectionSchemaField[],
  };
}
