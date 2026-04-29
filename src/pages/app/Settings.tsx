import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  return (
    <>
      <Topbar breadcrumb={[{ label: "Acme Inc." }, { label: "Settings" }]} />
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
                <div className="h-14 w-14 rounded-full bg-gradient-primary grid place-items-center text-lg font-bold text-primary-foreground shadow-glow">JD</div>
                <Button variant="outline" size="sm">Upload new picture</Button>
                <Button variant="ghost" size="sm" className="text-destructive">Remove</Button>
              </div>
              <Separator />
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Full name</Label><Input defaultValue="Jane Doe" /></div>
                <div className="space-y-2"><Label>Email</Label><Input defaultValue="jane@dashforge.io" /></div>
                <div className="space-y-2"><Label>Role</Label><Input defaultValue="Owner" disabled /></div>
                <div className="space-y-2"><Label>Timezone</Label><Input defaultValue="Europe/Stockholm" /></div>
              </div>
              <div className="flex justify-end">
                <Button className="bg-gradient-primary shadow-glow">Save changes</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="workspace" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="space-y-2"><Label>Workspace name</Label><Input defaultValue="Acme Inc." /></div>
              <div className="space-y-2"><Label>Slug</Label><Input defaultValue="acme" /></div>
              <Separator />
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <h4 className="text-sm font-semibold text-destructive">Danger zone</h4>
                <p className="text-xs text-muted-foreground mt-1 mb-3">Deleting this workspace is permanent.</p>
                <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10">Delete workspace</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              {[
                ["Dark mode", "Use dark theme across the app", true],
                ["Reduce motion", "Disable non-essential animations", false],
                ["Compact layout", "Tighter spacing for dense data", false],
              ].map(([t, d, v]) => (
                <div key={t as string} className="flex items-center justify-between">
                  <div><div className="text-sm font-medium">{t}</div><div className="text-xs text-muted-foreground">{d}</div></div>
                  <Switch defaultChecked={v as boolean} />
                </div>
              ))}
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
