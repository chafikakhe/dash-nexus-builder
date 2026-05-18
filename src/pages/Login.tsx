import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase, isSupabaseConfigured, clearInvalidStoredSession } from "@/lib/supabase";
import { toast } from "sonner";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

const signUpSchema = signInSchema.extend({
  displayName: z.string().trim().min(1, "Required").max(60),
  workspace: z.string().trim().min(2, "Workspace name").max(60),
});

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/app";
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [signin, setSignin] = useState({ email: "", password: "" });
  const [signup, setSignup] = useState({ email: "", password: "", displayName: "", workspace: "" });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = signInSchema.safeParse(signin);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (!isSupabaseConfigured) { setError("Add your Supabase URL + anon key in .env.local"); return; }
    setLoading(true);
    setError(null);
    try {
      // Remove any stale/malformed session to avoid triggering bad refresh requests
      clearInvalidStoredSession();
      const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
      console.debug("[login] signInWithPassword result", { data, error });
      if (error) {
        setError(error.message ?? "Sign in failed");
        setLoading(false);
        return;
      }

      // If a session is returned immediately, navigate to the app.
      if (data?.session) {
        toast.success("Welcome back");
        navigate(from, { replace: true });
      } else {
        // No session means email confirmation or other flow is required
        toast.success("Check your inbox to confirm your email");
      }
    } catch (e: any) {
      console.debug("[login] unexpected error", e);
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = signUpSchema.safeParse(signup);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (!isSupabaseConfigured) { setError("Add your Supabase URL + anon key in .env.local"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { display_name: parsed.data.displayName },
      },
    });
    if (error) { setLoading(false); setError(error.message); return; }

    // If session exists immediately (email confirmation disabled), bootstrap an org
    if (data.session) {
      const slug = parsed.data.workspace.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + "-" + Math.random().toString(36).slice(2, 6);
      const { error: orgErr } = await supabase.from("orgs").insert({
        name: parsed.data.workspace,
        slug,
        owner_id: data.user!.id,
        created_by: data.user!.id,
      });
      if (orgErr) console.error("[signup] org create", orgErr);
      toast.success("Workspace created");
      navigate("/app", { replace: true });
    } else {
      toast.success("Check your inbox to confirm your email");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm animate-fade-in">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg mb-10">
            <div className="h-8 w-8 rounded-md bg-gradient-primary grid place-items-center shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            DashForge
          </Link>

          <Tabs value={tab} onValueChange={(v) => { setTab(v as "signin" | "signup"); setError(null); }}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground mt-1">Sign in to your DashForge workspace.</p>
              <form onSubmit={handleSignIn} className="mt-6 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" autoComplete="email" placeholder="you@company.com"
                    value={signin.email} onChange={(e) => setSignin({ ...signin, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-pw">Password</Label>
                  <Input id="si-pw" type="password" autoComplete="current-password" placeholder="••••••••"
                    value={signin.password} onChange={(e) => setSignin({ ...signin, password: e.target.value })} />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow h-10">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
              <p className="text-sm text-muted-foreground mt-1">Free forever. Upgrade anytime.</p>
              <form onSubmit={handleSignUp} className="mt-6 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Your name</Label>
                    <Input id="su-name" placeholder="Alex Rivera"
                      value={signup.displayName} onChange={(e) => setSignup({ ...signup, displayName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-ws">Workspace</Label>
                    <Input id="su-ws" placeholder="Acme Inc."
                      value={signup.workspace} onChange={(e) => setSignup({ ...signup, workspace: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Work email</Label>
                  <Input id="su-email" type="email" autoComplete="email" placeholder="you@company.com"
                    value={signup.email} onChange={(e) => setSignup({ ...signup, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-pw">Password</Label>
                  <Input id="su-pw" type="password" autoComplete="new-password" placeholder="At least 8 characters"
                    value={signup.password} onChange={(e) => setSignup({ ...signup, password: e.target.value })} />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow h-10">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create workspace <ArrowRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {!isSupabaseConfigured && (
            <div className="mt-6 rounded-md border border-border bg-card/60 p-3 text-xs text-muted-foreground">
              ⚠️ Supabase not configured yet. Open <code className="text-foreground">src/lib/supabase.ts</code> and paste your project URL + anon key.
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:flex relative items-center justify-center bg-card border-l border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-aurora" />
        <div className="absolute inset-0 grid-bg opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative max-w-md p-10">
          <blockquote className="text-2xl font-semibold tracking-tight leading-snug">
            "DashForge replaced three internal tools and a $12k/mo BI vendor in a single weekend."
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-primary grid place-items-center font-bold text-primary-foreground">A</div>
            <div>
              <div className="text-sm font-medium">Alex Rivera</div>
              <div className="text-xs text-muted-foreground">CTO at Northwind Labs</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
