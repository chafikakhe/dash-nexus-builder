import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, Database, Filter, Download, Sparkles, Upload,
  Type, Hash, ToggleLeft, ListChecks, Calendar, Image as Img,
  Trash2, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCollections, useCollectionRecords, FieldType, Field,
} from "@/hooks/useCollections";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ImportModal } from "@/components/import/ImportModal";
import { useWorkspacePermissions } from "@/hooks/useWorkspacePermissions";

const fieldIcons: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  text: Type, number: Hash, boolean: ToggleLeft, select: ListChecks, date: Calendar, image: Img,
};

const FIELD_TYPES: FieldType[] = ["text", "number", "boolean", "select", "date", "image"];

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function Collections() {
  const { currentOrgId, user } = useAuth();
  const { canCreateContent, canEditWorkspaceContent, isReadOnlyMember, isAdmin } = useWorkspacePermissions();
  const {
    collections, loading: loadingCols,
    refetch: refetchCollections,
    createCollection, updateSchema, removeCollection,
  } = useCollections();

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = collections.find((c) => c.id === activeId) ?? collections[0] ?? null;
  const activeCollectionId = active?.id ?? null;

  const {
    records, loading: loadingRecs, addRecord, updateRecord, removeRecord,
    refetch: refetchRecords,
  } = useCollectionRecords(activeCollectionId, currentOrgId);

  const [query, setQuery] = useState("");

  // Dialogs
  const [openNewCol, setOpenNewCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [creatingCol, setCreatingCol] = useState(false);

  const [openNewField, setOpenNewField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [openImport, setOpenImport] = useState(false);
  const canEditActiveCollection = canEditWorkspaceContent || (isAdmin && active?.permission === "edit");

  useEffect(() => {
    if (!canEditActiveCollection) setOpenNewField(false);
  }, [canEditActiveCollection]);

  const filtered = useMemo(() => {
    if (!query) return records;
    const q = query.toLowerCase();
    return records.filter((r) =>
      Object.values(r.data ?? {}).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [records, query]);

  const handleCreateCollection = async () => {
    if (!newColName.trim()) return;
    setCreatingCol(true);
    const created = await createCollection(newColName.trim(), [
      { name: "name", type: "text" },
    ]);
    setCreatingCol(false);
    if (created) {
      toast.success("Collection created");
      setActiveId(created.id);
      setOpenNewCol(false);
      setNewColName("");
    }
  };

  const handleAddField = async () => {
    if (!active || !newFieldName.trim()) return;
    const next: Field[] = [...(active.schema ?? []), { name: newFieldName.trim(), type: newFieldType }];
    const ok = await updateSchema(active.id, next);
    if (ok) {
      toast.success("Field added");
      setOpenNewField(false);
      setNewFieldName(""); setNewFieldType("text");
    }
  };

  const handleRemoveField = async (fieldName: string) => {
    if (!active) return;
    if (!confirm(`Remove field "${fieldName}"? Existing values stay in record data.`)) return;
    const next = (active.schema ?? []).filter((f) => f.name !== fieldName);
    const ok = await updateSchema(active.id, next);
    if (ok) toast.success("Field removed");
  };

  const handleCellChange = async (recordId: string, fieldName: string, value: any) => {
    const rec = records.find((r) => r.id === recordId);
    if (!rec) return;
    await updateRecord(recordId, { ...(rec.data ?? {}), [fieldName]: value });
  };

  const handleExportCSV = () => {
    if (!active) return;
    const fields = active.schema ?? [];
    const header = fields.map((f) => csvEscape(f.name)).join(",");
    const rows = records.map((r) =>
      fields.map((f) => csvEscape(r.data?.[f.name])).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${active.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Workspace" }, { label: "Collections" }]}
        actions={
          canCreateContent ? (
            <Button size="sm" className="bg-gradient-primary shadow-glow" onClick={() => setOpenNewCol(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />New collection
            </Button>
          ) : (
            <Badge variant="secondary">{isAdmin ? "Assigned access" : "Read-only mode"}</Badge>
          )
        }
      />
      <div className="flex-1 flex min-h-0">
        {/* Collections list */}
        <aside className="w-60 border-r border-border bg-card/60 backdrop-blur-xl p-3 overflow-y-auto scrollbar-thin">
          <div className="px-2 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Collections
          </div>
          {loadingCols && (
            <div className="px-2.5 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          )}
          {!loadingCols && collections.length === 0 && (
            <div className="px-2.5 py-2 text-xs text-muted-foreground">
              {isReadOnlyMember || isAdmin ? "No shared collections" : "No collections yet"}
            </div>
          )}
          {collections.map((c) => {
            const canEditCollection = canEditWorkspaceContent || (isAdmin && c.permission === "edit");
            return (
            <div key={c.id} className="group flex items-center">
              <button
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "flex-1 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active?.id === c.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <div className="h-6 w-6 rounded bg-gradient-primary/15 border border-primary/20 grid place-items-center text-[10px] font-bold text-primary">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 text-left truncate">{c.name}</span>
              </button>
              {canEditCollection && (
              <button
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  if (!confirm(`Delete collection "${c.name}"?`)) return;
                  const ok = await removeCollection(c.id);
                  if (ok && active?.id === c.id) setActiveId(null);
                  if (ok) toast.success("Collection deleted");
                }}
                aria-label="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
              )}
            </div>
            );
          })}
          {canCreateContent && (
          <Button
            variant="ghost" size="sm"
            className="w-full mt-2 justify-start text-muted-foreground hover:text-foreground"
            onClick={() => setOpenNewCol(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-2" />New collection
          </Button>
          )}
        </aside>

        {/* Records */}
        <main className="flex-1 flex flex-col min-w-0">
          {!active ? (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
              {loadingCols ? "Loading…" : isReadOnlyMember || isAdmin ? "No shared collections" : "Create a collection to get started"}
            </div>
          ) : (
            <>
              <div className="border-b border-border px-5 py-3 flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">{active.name}</h2>
                <Badge variant="secondary" className="font-normal">{records.length} records</Badge>
                <div className="ml-auto flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={query} onChange={(e) => setQuery(e.target.value)}
                      className="pl-8 h-8 w-56 bg-secondary/40 text-xs" placeholder="Search records…"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-3.5 w-3.5" />Filter</Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV}>
                    <Download className="h-3.5 w-3.5" />Export
                  </Button>
                  {canEditActiveCollection && <Button variant="outline" size="sm" className="gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" />AI</Button>}
                  {canEditActiveCollection && currentOrgId && user && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setOpenImport(true)}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Import Data
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto scrollbar-thin">
                {loadingRecs ? (
                  <div className="p-12 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading records…
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border">
                      <tr>
                        {(active.schema ?? []).map((f) => {
                          const Icon = fieldIcons[f.type];
                          return (
                            <th key={f.name} className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5 group">
                              <div className="flex items-center gap-1.5">
                                <Icon className="h-3 w-3" />
                                <span>{f.name}</span>
                                {canEditActiveCollection && (
                                <button
                                  onClick={() => handleRemoveField(f.name)}
                                  className="opacity-0 group-hover:opacity-100 ml-auto text-muted-foreground hover:text-destructive"
                                  aria-label="Remove field"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                                )}
                              </div>
                            </th>
                          );
                        })}
                        <th className="px-4 py-2.5 w-10">
                          {canEditActiveCollection && (
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => setOpenNewField(true)}
                            aria-label="Add field"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          )}
                        </th>
                        <th className="px-4 py-2.5 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors group">
                          {(active.schema ?? []).map((f) => (
                            <td key={f.name} className="px-2 py-1 align-middle">
                              <CellEditor
                                field={f}
                                value={r.data?.[f.name]}
                                onChange={(v) => handleCellChange(r.id, f.name, v)}
                                readOnly={!canEditActiveCollection}
                              />
                            </td>
                          ))}
                          <td />
                          <td className="px-2 py-1 text-right">
                            {canEditActiveCollection && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={async () => {
                                    const ok = await removeRecord(r.id);
                                    if (ok) toast.success("Record deleted");
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete row
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      ))}
                      {canEditActiveCollection && (
                      <tr>
                        <td colSpan={(active.schema?.length ?? 0) + 2} className="px-4 py-2">
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                            onClick={async () => {
                              const r = await addRecord({});
                              if (r) toast.success("Row added");
                            }}
                          >
                            <Plus className="h-3 w-3" /> New record
                          </button>
                        </td>
                      </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* New collection */}
      <Dialog open={openNewCol} onOpenChange={setOpenNewCol}>
        <DialogContent>
          <DialogHeader><DialogTitle>New collection</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="col-name">Name</Label>
            <Input
              id="col-name" value={newColName} onChange={(e) => setNewColName(e.target.value)}
              placeholder="customers"
              onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewCol(false)}>Cancel</Button>
            <Button onClick={handleCreateCollection} disabled={creatingCol || !newColName.trim()} className="bg-gradient-primary">
              {creatingCol ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New field */}
      <Dialog open={openNewField} onOpenChange={setOpenNewField}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add field</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="field-name">Name</Label>
              <Input
                id="field-name" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="email"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as FieldType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNewField(false)}>Cancel</Button>
            <Button onClick={handleAddField} disabled={!newFieldName.trim()} className="bg-gradient-primary">
              Add field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {currentOrgId && user && (
        <ImportModal
          open={openImport}
          onOpenChange={setOpenImport}
          orgId={currentOrgId}
          userId={user.id}
          collections={collections}
          onImportSuccess={async (collectionId) => {
            toast.success("Data imported successfully!");
            setActiveId(collectionId);
            await refetchCollections();
            if (collectionId === activeCollectionId) {
              await refetchRecords();
            }
          }}
        />
      )}
    </>
  );
}

function CellEditor({
  field, value, onChange, readOnly = false,
}: {
  field: Field;
  value: any;
  onChange: (v: any) => void;
  readOnly?: boolean;
}) {
  const [local, setLocal] = useState<any>(value ?? "");

  // Sync if external changes
  if (value !== undefined && value !== local && document.activeElement?.getAttribute("data-cell") !== `${field.name}`) {
    // no-op; we only sync on mount
  }

  if (field.type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        disabled={readOnly}
        className="h-4 w-4 accent-primary"
      />
    );
  }
  if (field.type === "number") {
    return (
      <input
        type="number"
        defaultValue={value ?? ""}
        onBlur={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        readOnly={readOnly}
        className="w-full bg-transparent px-2 py-1 text-sm focus:bg-secondary/60 rounded outline-none focus:ring-1 focus:ring-primary tabular-nums"
      />
    );
  }
  if (field.type === "date") {
    return (
      <input
        type="date"
        defaultValue={value ?? ""}
        onBlur={(e) => onChange(e.target.value || null)}
        readOnly={readOnly}
        className="w-full bg-transparent px-2 py-1 text-sm focus:bg-secondary/60 rounded outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }
  return (
    <input
      type="text"
      defaultValue={value ?? ""}
      onBlur={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      className="w-full bg-transparent px-2 py-1 text-sm focus:bg-secondary/60 rounded outline-none focus:ring-1 focus:ring-primary"
    />
  );
}
