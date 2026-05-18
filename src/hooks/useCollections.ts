import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type FieldType = "text" | "number" | "boolean" | "select" | "date" | "image";
export type Field = { name: string; type: FieldType };

export type Collection = {
  id: string;
  org_id: string;
  name: string;
  schema: Field[];
  created_at: string;
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
        console.debug("[collections] Fetched", data?.length ?? 0, "collections");
        setCollections((data ?? []).map((c: any) => ({ ...c, schema: c.schema ?? [] })) as Collection[]);
      }
    } catch (e: any) {
      console.error("[collections] Unexpected fetch error:", e);
      toast.error("Failed to load collections");
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

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
        if (membership.role === "viewer") {
          toast.error("You need editor permissions to create collections");
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
        const col = { ...(data as any), schema: (data as any).schema ?? [] } as Collection;
        setCollections((prev) => [...prev, col]);
        return col;
      } catch (e: any) {
        console.error("[collections] Unexpected create error:", e);
        toast.error("Failed to create collection");
        return null;
      }
    },
    [currentOrgId, user]
  );

  const updateSchema = useCallback(async (id: string, schema: Field[]) => {
    console.debug("[collections] Updating schema for collection:", id, { schema });
    try {
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
      return true;
    } catch (e: any) {
      console.error("[collections] Unexpected update error:", e);
      toast.error("Failed to update schema");
      return false;
    }
  }, []);

  const removeCollection = useCallback(async (id: string) => {
    console.debug("[collections] Deleting collection:", id);
    try {
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
      return true;
    } catch (e: any) {
      console.error("[collections] Unexpected delete error:", e);
      toast.error("Failed to delete collection");
      return false;
    }
  }, []);

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
