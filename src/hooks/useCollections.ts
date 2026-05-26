import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useWorkspacePermissions } from "@/hooks/useWorkspacePermissions";
import { logWorkspaceActivity } from "@/lib/activity";

export type FieldType = "text" | "number" | "boolean" | "select" | "date" | "image" | "json";
export type Field = { name: string; type: FieldType };

export type Collection = {
  id: string;
  org_id: string;
  name: string;
  schema: Field[];
  created_at: string;
  permission?: "view" | "edit";
};

export type CollectionRecord = {
  id: string;
  collection_id: string;
  org_id: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export function useCollections() {
  const { currentOrgId, user } = useAuth();
  const { canCreateContent, isOwner } = useWorkspacePermissions();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!currentOrgId) {
      console.debug("[collections] No currentOrgId, clearing collections");
      setCollections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      console.debug("[collections] Fetching collections for org:", currentOrgId);
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq("org_id", currentOrgId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[collections] Fetch error:", error.message, error);
        toast.error(`Failed to load collections: ${error.message}`);
      } else {
        const rows = ((data ?? []).map((c: any) => ({ ...c, schema: c.schema ?? [] })) as Collection[]);
        if (isOwner) {
          setCollections(rows.map((collection) => ({ ...collection, permission: "edit" })));
        } else if (user && rows.length > 0) {
          const { data: permissions, error: permissionError } = await supabase
            .from("collection_permissions")
            .select("collection_id, permission")
            .eq("user_id", user.id)
            .in("collection_id", rows.map((collection) => collection.id));
          if (permissionError) console.error("[collections] Permission lookup error:", permissionError);
          const permissionByCollection = new Map(
            (permissions ?? []).map((permission) => [permission.collection_id, permission.permission as "view" | "edit"])
          );
          setCollections(rows.map((collection) => ({ ...collection, permission: permissionByCollection.get(collection.id) ?? "view" })));
        } else {
          setCollections(rows);
        }
        console.debug("[collections] Fetched", rows.length, "collections");
      }
    } catch (e: any) {
      console.error("[collections] Unexpected fetch error:", e);
      toast.error("Failed to load collections");
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, isOwner, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createCollection = useCallback(
    async (name: string, schema: Field[] = []) => {
      if (!currentOrgId) {
        console.warn("[collections] createCollection: No currentOrgId");
        toast.error("No workspace selected");
        return null;
      }
      if (!user) {
        console.warn("[collections] createCollection: No user logged in");
        toast.error("Not logged in");
        return null;
      }
      console.debug("[collections] Creating collection:", { name, orgId: currentOrgId, userId: user.id, schema });

      // Verify user membership and role in org_members to avoid RLS failures
      try {
        const { data: membership, error: membErr } = await supabase
          .from("org_members")
          .select("role")
          .eq("org_id", currentOrgId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (membErr) {
          console.error("[collections] membership check error", membErr);
        }
        if (!membership) {
          console.warn("[collections] User not found in org_members for org", currentOrgId);
          toast.error("You don't have access to this workspace");
          return null;
        }
        if (!canCreateContent || membership.role !== "owner") {
          toast.error("Only workspace owners can create collections");
          return null;
        }
      } catch (e) {
        console.error("[collections] membership check unexpected error", e);
      }
      try {
        const { data, error } = await supabase
          .from("collections")
          .insert({ org_id: currentOrgId, name, schema })
          .select("*")
          .single();

        if (error) {
          console.error("[collections] Insert error:", error.code, error.message, error);
          // Show detailed error for RLS violations
          if (error.code === "PGRST301" || error.message.includes("row level security")) {
            toast.error("Permission denied. Check your workspace role.");
          } else {
            toast.error(`Failed to create collection: ${error.message}`);
          }
          return null;
        }

        console.debug("[collections] Collection created successfully:", data);
        const col = { ...(data as any), schema: (data as any).schema ?? [], permission: "edit" as const } as Collection;
        setCollections((prev) => [...prev, col]);
        void logWorkspaceActivity({
          workspaceId: currentOrgId,
          action: "collection_created",
          targetType: "collection",
          targetName: col.name,
          metadata: {
            collection_id: col.id,
            field_count: col.schema.length,
          },
        });
        return col;
      } catch (e: any) {
        console.error("[collections] Unexpected create error:", e);
        toast.error("Failed to create collection");
        return null;
      }
    },
    [canCreateContent, currentOrgId, user]
  );

  const updateSchema = useCallback(async (id: string, schema: Field[]) => {
    console.debug("[collections] Updating schema for collection:", id, { schema });
    try {
      const existing = collections.find((collection) => collection.id === id);
      const { error } = await supabase.from("collections").update({ schema }).eq("id", id);
      if (error) {
        console.error("[collections] Update error:", error.message, error);
        if (error.code === "PGRST301" || error.message.includes("row level security")) {
          toast.error("Permission denied. Check your workspace role.");
        } else {
          toast.error(`Failed to update schema: ${error.message}`);
        }
        return false;
      }
      console.debug("[collections] Schema updated successfully");
      setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, schema } : c)));
      if (currentOrgId && existing) {
        void logWorkspaceActivity({
          workspaceId: currentOrgId,
          action: "collection_updated",
          targetType: "collection",
          targetName: existing.name,
          metadata: {
            collection_id: id,
            field_count: schema.length,
            field_names: schema.map((field) => field.name),
          },
        });
      }
      return true;
    } catch (e: any) {
      console.error("[collections] Unexpected update error:", e);
      toast.error("Failed to update schema");
      return false;
    }
  }, [collections, currentOrgId]);

  const removeCollection = useCallback(async (id: string) => {
    console.debug("[collections] Deleting collection:", id);
    try {
      const existing = collections.find((collection) => collection.id === id);
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) {
        console.error("[collections] Delete error:", error.message, error);
        if (error.code === "PGRST301" || error.message.includes("row level security")) {
          toast.error("Permission denied. Check your workspace role.");
        } else {
          toast.error(`Failed to delete collection: ${error.message}`);
        }
        return false;
      }
      console.debug("[collections] Collection deleted successfully");
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (currentOrgId && existing) {
        void logWorkspaceActivity({
          workspaceId: currentOrgId,
          action: "collection_deleted",
          targetType: "collection",
          targetName: existing.name,
          metadata: {
            collection_id: existing.id,
          },
        });
      }
      return true;
    } catch (e: any) {
      console.error("[collections] Unexpected delete error:", e);
      toast.error("Failed to delete collection");
      return false;
    }
  }, [collections, currentOrgId]);

  return { collections, loading, refetch: fetchAll, createCollection, updateSchema, removeCollection };
}

/**
 * Hook for managing records within a collection.
 * Includes comprehensive logging for debugging database operations.
 */
export function useCollectionRecords(collectionId: string | null, orgId: string | null) {
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!collectionId) {
      console.debug("[collection-records] No collectionId, clearing records");
      setRecords([]);
      return;
    }
    setLoading(true);
    try {
      console.debug("[collection-records] Fetching records for collection:", collectionId);
      const { data, error } = await supabase
        .from("collection_records")
        .select("*")
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[collection-records] Fetch error:", error.message, error);
        toast.error(`Failed to load records: ${error.message}`);
      } else {
        console.debug("[collection-records] Fetched", data?.length ?? 0, "records");
        setRecords((data ?? []) as CollectionRecord[]);
      }
    } catch (e: any) {
      console.error("[collection-records] Unexpected fetch error:", e);
      toast.error("Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addRecord = useCallback(async (data: Record<string, any> = {}) => {
    if (!collectionId || !orgId) {
      console.warn("[collection-records] addRecord: Missing collectionId or orgId");
      toast.error("Collection not available");
      return null;
    }
    console.debug("[collection-records] Adding record to collection:", collectionId, { data });
    try {
      const { data: row, error } = await supabase
        .from("collection_records")
        .insert({ collection_id: collectionId, org_id: orgId, data })
        .select("*")
        .single();
      if (error) {
        console.error("[collection-records] Insert error:", error.message, error);
        if (error.code === "PGRST301" || error.message.includes("row level security")) {
          toast.error("Permission denied. Check your workspace role.");
        } else {
          toast.error(`Failed to add record: ${error.message}`);
        }
        return null;
      }
      console.debug("[collection-records] Record added successfully:", row);
      setRecords((prev) => [...prev, row as CollectionRecord]);
      return row as CollectionRecord;
    } catch (e: any) {
      console.error("[collection-records] Unexpected add error:", e);
      toast.error("Failed to add record");
      return null;
    }
  }, [collectionId, orgId]);

  const updateRecord = useCallback(async (id: string, data: Record<string, any>) => {
    console.debug("[collection-records] Updating record:", id, { data });
    try {
      const { error } = await supabase
        .from("collection_records")
        .update({ data, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("[collection-records] Update error:", error.message, error);
        if (error.code === "PGRST301" || error.message.includes("row level security")) {
          toast.error("Permission denied. Check your workspace role.");
        } else {
          toast.error(`Failed to update record: ${error.message}`);
        }
        return false;
      }
      console.debug("[collection-records] Record updated successfully");
      setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, data } : r)));
      return true;
    } catch (e: any) {
      console.error("[collection-records] Unexpected update error:", e);
      toast.error("Failed to update record");
      return false;
    }
  }, []);

  const removeRecord = useCallback(async (id: string) => {
    console.debug("[collection-records] Deleting record:", id);
    try {
      const { error } = await supabase.from("collection_records").delete().eq("id", id);
      if (error) {
        console.error("[collection-records] Delete error:", error.message, error);
        if (error.code === "PGRST301" || error.message.includes("row level security")) {
          toast.error("Permission denied. Check your workspace role.");
        } else {
          toast.error(`Failed to delete record: ${error.message}`);
        }
        return false;
      }
      console.debug("[collection-records] Record deleted successfully");
      setRecords((prev) => prev.filter((r) => r.id !== id));
      return true;
    } catch (e: any) {
      console.error("[collection-records] Unexpected delete error:", e);
      toast.error("Failed to delete record");
      return false;
    }
  }, []);

  return { records, loading, addRecord, updateRecord, removeRecord, refetch: fetchAll };
}
