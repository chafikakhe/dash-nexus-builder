import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity } from "@/lib/activity";
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
    if (!currentOrgId) { setCollections([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("org_id", currentOrgId)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setCollections((data ?? []).map((c: any) => ({ ...c, schema: c.schema ?? [] })) as Collection[]);
    setLoading(false);
  }, [currentOrgId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createCollection = useCallback(
    async (name: string, schema: Field[] = []) => {
      if (!currentOrgId || !user) return null;
      const { data, error } = await supabase
        .from("collections")
        .insert({ org_id: currentOrgId, name, schema })
        .select("*")
        .single();
      if (error) { toast.error(error.message); return null; }
      const col = { ...(data as any), schema: (data as any).schema ?? [] } as Collection;
      setCollections((prev) => [...prev, col]);
      logActivity({
        orgId: currentOrgId, action: "collection.created",
        targetType: "collection", targetId: col.id, targetLabel: col.name,
      });
      return col;
    },
    [currentOrgId, user]
  );

  const updateSchema = useCallback(async (id: string, schema: Field[]) => {
    const { error } = await supabase.from("collections").update({ schema }).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, schema } : c)));
    return true;
  }, []);

  const removeCollection = useCallback(async (id: string) => {
    const target = collections.find((c) => c.id === id);
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    setCollections((prev) => prev.filter((c) => c.id !== id));
    logActivity({
      orgId: currentOrgId, action: "collection.deleted",
      targetType: "collection", targetId: id, targetLabel: target?.name,
    });
    return true;
  }, [collections, currentOrgId]);

  return { collections, loading, refetch: fetchAll, createCollection, updateSchema, removeCollection };
}

export function useCollectionRecords(collectionId: string | null, orgId: string | null) {
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!collectionId) { setRecords([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("collection_records")
      .select("*")
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setRecords((data ?? []) as CollectionRecord[]);
    setLoading(false);
  }, [collectionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addRecord = useCallback(async (data: Record<string, any> = {}) => {
    if (!collectionId || !orgId) return null;
    const { data: row, error } = await supabase
      .from("collection_records")
      .insert({ collection_id: collectionId, org_id: orgId, data })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return null; }
    setRecords((prev) => [...prev, row as CollectionRecord]);
    return row as CollectionRecord;
  }, [collectionId, orgId]);

  const updateRecord = useCallback(async (id: string, data: Record<string, any>) => {
    const { error } = await supabase
      .from("collection_records")
      .update({ data, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return false; }
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, data } : r)));
    return true;
  }, []);

  const removeRecord = useCallback(async (id: string) => {
    const { error } = await supabase.from("collection_records").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    setRecords((prev) => prev.filter((r) => r.id !== id));
    return true;
  }, []);

  return { records, loading, addRecord, updateRecord, removeRecord, refetch: fetchAll };
}
