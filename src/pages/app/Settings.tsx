import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

export default function Settings() {
  const { user, currentOrgId, orgs, refreshOrgs, signOut } = useAuth();
  const currentOrg = orgs.find((o) => o.id === currentOrgId);
  const myRole = currentOrg?.role;
  const canManageOrg = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  // Profile state
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  // Workspace state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setDisplayName(data?.display_name ?? "");
        setAvatarUrl(data?.avatar_url ?? "");
        setProfileLoading(false);
      });
  }, [user]);

  useEffect(() => {
    setOrgName(currentOrg?.name ?? "");
    setOrgSlug(currentOrg?.slug ?? "");
  }, [currentOrg?.id, currentOrg?.name, currentOrg?.slug]);

  const initials = (displayName || user?.email || "?")
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, avatar_url: avatarUrl || null, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    logActivity({ orgId: currentOrgId, action: "profile.updated" });
  };

  const saveOrg = async () => {
    if (!currentOrgId) return;
    setSavingOrg(true);
    const { error } = await supabase
      .from("orgs")
      .update({ name: orgName, slug: orgSlug })
      .eq("id", currentOrgId);
    setSavingOrg(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Workspace updated");
    logActivity({
      orgId: currentOrgId, action: "workspace.updated",
      targetType: "org", targetId: currentOrgId, targetLabel: orgName,
    });
    refreshOrgs();
  };

  const deleteOrg = async () => {
    if (!currentOrgId || !isOwner) return;
    if (!confirm(`Permanently delete "${orgName}"? This deletes ALL its dashboards, collections and data.`)) return;
    setDeletingOrg(true);
    const { error } = await supabase.from("orgs").delete().eq("id", currentOrgId);
    setDeletingOrg(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Workspace deleted");
    await refreshOrgs();
  };

  return (
    <>
      <Topbar breadcrumb={[{ label: currentOrg?.name ?? "Workspace" }, { label: "Settings" }]} />
      <main className="flex-1 p-6 max-w-3xl animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and workspace.</p>

        <Tabs defaultValue="profile" className="mt-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              {profileLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-gradient-primary grid place-items-center text-lg font-bold text-primary-foreground shadow-glow overflow-hidden">
                      {avatarUrl
                        ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                        : initials}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Paste an avatar URL below to change your picture.
                    </div>
                  </div>
                  <Separator />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Display name</Label>
                      <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={user?.email ?? ""} disabled />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Avatar URL</Label>
                      <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={saveProfile} disabled={savingProfile} className="bg-gradient-primary shadow-glow">
                      {savingProfile && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                      Save changes
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="workspace" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              {!currentOrg ? (
                <div className="text-sm text-muted-foreground">No workspace selected.</div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Workspace name</Label>
                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!canManageOrg} />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} disabled={!canManageOrg} />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Input value={currentOrg.plan} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Your role</Label>
                    <Input value={currentOrg.role} disabled className="capitalize" />
                  </div>
                  {canManageOrg && (
                    <div className="flex justify-end">
                      <Button onClick={saveOrg} disabled={savingOrg} className="bg-gradient-primary shadow-glow">
                        {savingOrg && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        Save workspace
                      </Button>
                    </div>
                  )}
                  {isOwner && (
                    <>
                      <Separator />
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                        <h4 className="text-sm font-semibold text-destructive">Danger zone</h4>
                        <p className="text-xs text-muted-foreground mt-1 mb-3">
                          Deleting this workspace is permanent and removes all its data.
                        </p>
                        <Button
                          variant="outline" size="sm"
                          onClick={deleteOrg} disabled={deletingOrg}
                          className="border-destructive/50 text-destructive hover:bg-destructive/10"
                        >
                          {deletingOrg && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                          Delete workspace
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="account" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Sign out</div>
                <div className="text-xs text-muted-foreground">End your session on this device.</div>
              </div>
              <Button variant="outline" onClick={signOut}>Sign out</Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
