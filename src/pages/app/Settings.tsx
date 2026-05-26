import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspacePermissions } from "@/hooks/useWorkspacePermissions";
import { deleteWorkspace } from "@/lib/workspace-queries";
import { toast } from "sonner";
import { useAppearance } from "@/contexts/AppearanceContext";
import { ACCENT_PRESETS, ACCENT_VALUES } from "@/lib/appearance";

export default function Settings() {
  const navigate = useNavigate();
  const { user, currentOrgId, orgs, refreshOrgs } = useAuth();
  const { role, isOwner } = useWorkspacePermissions();
  const {
    theme,
    setTheme,
    accentPreset,
    setAccentPreset,
    reduceMotion,
    setReduceMotion,
    compactLayout,
    setCompactLayout,
  } = useAppearance();
  const currentOrg = orgs.find((o) => o.id === currentOrgId);

  const [fullName, setFullName] = useState(user?.user_metadata?.display_name ?? "");
  const [timezone, setTimezone] = useState("UTC");
  const [orgName, setOrgName] = useState(currentOrg?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);

  const userInitial = user?.email?.[0].toUpperCase() ?? "?";

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast.error("Please enter a full name");
      return;
    }
    setSaving(true);
    // TODO: Implement profile save to Supabase profiles table
    setSaving(false);
    toast.success("Profile saved");
  };

  const handleDeleteWorkspace = async () => {
    if (!currentOrgId) {
      toast.error("Select a workspace before deleting it.");
      return;
    }

    setDeletingWorkspace(true);

    try {
      const result = await deleteWorkspace(currentOrgId);
      await refreshOrgs();
      toast.success(`Workspace "${result.workspace_name}" deleted.`);
      navigate("/app", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete workspace.";
      toast.error(message);
    } finally {
      setDeletingWorkspace(false);
    }
  };

  return (
    <>
      <Topbar breadcrumb={[{ label: currentOrg?.name ?? "Workspace" }, { label: "Settings" }]} />
      <main className="flex-1 p-6 max-w-3xl animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account, workspace and preferences.</p>

        <Tabs defaultValue="profile" className="mt-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="api">API & Tokens</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6 space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-gradient-primary grid place-items-center text-lg font-bold text-primary-foreground shadow-glow">{userInitial}</div>
                <Button variant="outline" size="sm">Upload new picture</Button>
                <Button variant="ghost" size="sm" className="text-destructive">Remove</Button>
              </div>
              <Separator />
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input value={role ?? currentOrg?.role ?? "—"} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button className="bg-gradient-primary shadow-glow" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="workspace" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="space-y-2">
                <Label>Workspace name</Label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={currentOrg?.slug ?? ""} disabled />
              </div>
              <Separator />
              {isOwner ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <h4 className="text-sm font-semibold text-destructive">Danger zone</h4>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Deleting this workspace is permanent and removes its collections,
                    dashboards, memberships, and workspace activity.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/50 text-destructive hover:bg-destructive/10"
                        disabled={deletingWorkspace}
                      >
                        {deletingWorkspace ? "Deleting…" : "Delete workspace"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes{" "}
                          <span className="font-medium text-foreground">
                            {currentOrg?.name ?? "this workspace"}
                          </span>{" "}
                          and all related data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingWorkspace}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(event) => {
                            event.preventDefault();
                            void handleDeleteWorkspace();
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={deletingWorkspace}
                        >
                          {deletingWorkspace ? "Deleting…" : "Delete workspace"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="mt-6">
            <div className="rounded-xl border border-border bg-card/95 p-6 shadow-card space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Dark mode</div>
                  <div className="text-xs text-muted-foreground">
                    Use the current dark UI or switch the whole app to light mode.
                  </div>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium">Accent color</div>
                  <div className="text-xs text-muted-foreground">
                    Updates primary actions, links, sidebar highlights, focus rings, and chart accents.
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {ACCENT_VALUES.map((value) => {
                    const preset = ACCENT_PRESETS[value];
                    const active = accentPreset === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAccentPreset(value)}
                        className={[
                          "group rounded-xl border bg-secondary/35 px-3 py-3 text-left transition-all",
                          active
                            ? "border-primary shadow-glow ring-2 ring-primary/25"
                            : "border-border hover:border-primary/35 hover:bg-secondary/60",
                        ].join(" ")}
                        aria-pressed={active}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="h-8 w-8 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: preset.swatch }}
                            aria-hidden="true"
                          />
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                            {active ? <Check className="h-3.5 w-3.5" /> : null}
                          </span>
                        </div>
                        <div className="mt-3 text-sm font-medium text-foreground">{preset.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Reduce motion</div>
                  <div className="text-xs text-muted-foreground">Disable non-essential animations across the app.</div>
                </div>
                <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Compact layout</div>
                  <div className="text-xs text-muted-foreground">Use tighter radii and denser spacing for data-heavy views.</div>
                </div>
                <Switch checked={compactLayout} onCheckedChange={setCompactLayout} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              {["Weekly digest", "Mention notifications", "Workspace activity", "Product updates"].map((n) => (
                <div key={n} className="flex items-center justify-between">
                  <div className="text-sm font-medium">{n}</div>
                  <Switch defaultChecked />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="api" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <Label>Personal access token</Label>
              <div className="flex gap-2 mt-2">
                <Input value="dfg_••••••••••••••••••••••" readOnly className="font-mono text-xs" />
                <Button variant="outline">Rotate</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Use this token to authenticate API requests against the DashForge REST API.</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
