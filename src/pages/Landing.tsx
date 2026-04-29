import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, LayoutDashboard, Database, Zap, Github } from "lucide-react";

const features = [
  { icon: LayoutDashboard, title: "Visual builder", body: "Drag, drop, snap. Build dashboards like you sketch them." },
  { icon: Database, title: "Dynamic collections", body: "Airtable-style data with relations, formulas and live sync." },
  { icon: Sparkles, title: "AI native", body: "Describe a dashboard in English. Ship it in seconds." },
  { icon: Zap, title: "Real-time", body: "Streams, webhooks and Postgres listeners — out of the box." },
];

const logos = ["Acme", "Northwind", "Globex", "Initech", "Hooli", "Stark"];

export default function Landing() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/60 border-b border-border/50">
        <div className="container flex h-14 items-center">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <div className="h-7 w-7 rounded-md bg-gradient-primary grid place-items-center shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            DashForge
          </Link>
          <nav className="ml-10 hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#showcase" className="hover:text-foreground transition-colors">Showcase</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#docs" className="hover:text-foreground transition-colors">Docs</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/login">Sign in</Link></Button>
            <Button size="sm" asChild className="bg-gradient-primary shadow-glow">
              <Link to="/app">Open app <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-[0.15] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/70 bg-secondary/40 text-xs text-muted-foreground mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
              Now with AI dashboard generation
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05]">
              <span className="text-gradient">The dashboard builder</span>
              <br />
              <span className="text-gradient-primary">your team can actually use.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
              DashForge is the AI-native, drag-and-drop platform for internal tools, analytics, and operations. Built for teams that ship.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button size="lg" asChild className="bg-gradient-primary shadow-glow h-11">
                <Link to="/app">Start building free <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="h-11 gap-2">
                <Github className="h-4 w-4" /> View on GitHub
              </Button>
            </div>
          </div>

          {/* Product preview */}
          <div className="mt-16 relative animate-scale-in">
            <div className="absolute -inset-x-20 -top-10 h-[400px] bg-gradient-aurora pointer-events-none" />
            <div className="relative rounded-xl border border-border/70 bg-card/80 backdrop-blur-xl shadow-elevated overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 h-9 border-b border-border/70 bg-secondary/40">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                <span className="ml-3 text-xs text-muted-foreground font-mono">app.dashforge.io/dashboard/revenue</span>
              </div>
              <div className="aspect-[16/9] dot-bg p-6 grid grid-cols-12 gap-3">
                <div className="col-span-3 rounded-lg border border-border/70 bg-secondary/40 p-3">
                  <div className="text-xs text-muted-foreground">MRR</div>
                  <div className="text-2xl font-bold mt-1">$48.2k</div>
                  <div className="text-[10px] text-success mt-0.5">+12.4%</div>
                </div>
                <div className="col-span-3 rounded-lg border border-border/70 bg-secondary/40 p-3">
                  <div className="text-xs text-muted-foreground">Active users</div>
                  <div className="text-2xl font-bold mt-1">12,841</div>
                  <div className="text-[10px] text-success mt-0.5">+3.1%</div>
                </div>
                <div className="col-span-6 row-span-2 rounded-lg border border-border/70 bg-gradient-primary/10 p-3 flex items-end gap-1">
                  {[40, 65, 50, 80, 70, 90, 75, 95, 85, 100, 88, 110].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-gradient-primary opacity-80" style={{ height: `${h * 0.6}%` }} />
                  ))}
                </div>
                <div className="col-span-6 rounded-lg border border-border/70 bg-secondary/40 p-3">
                  <div className="text-xs text-muted-foreground">Conversion funnel</div>
                  <div className="mt-2 space-y-1.5">
                    {[100, 72, 48, 24].map((w, i) => (
                      <div key={i} className="h-2 rounded-full bg-gradient-primary" style={{ width: `${w}%`, opacity: 1 - i * 0.2 }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Logo cloud */}
          <div className="mt-20 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">Trusted by teams at</p>
            <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4 opacity-60">
              {logos.map((l) => (
                <span key={l} className="text-lg font-semibold tracking-tight">{l}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 border-t border-border/50">
        <div className="container">
          <div className="max-w-2xl mb-14">
            <p className="text-xs uppercase tracking-widest text-primary mb-3">Everything in one canvas</p>
            <h2 className="text-4xl font-bold tracking-tight">Built for the way modern teams work.</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div key={f.title} className="group rounded-xl border border-border/70 bg-card p-5 hover:border-primary/40 hover:shadow-glow transition-all">
                <div className="h-9 w-9 rounded-md bg-gradient-primary/15 border border-primary/20 grid place-items-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border/50">
        <div className="container">
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card to-secondary/40 p-12 text-center">
            <div className="absolute inset-0 bg-gradient-aurora opacity-60" />
            <div className="relative">
              <h2 className="text-4xl font-bold tracking-tight">Ship your first dashboard tonight.</h2>
              <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Free to start. No credit card. Bring your own data.</p>
              <Button size="lg" asChild className="mt-6 bg-gradient-primary shadow-glow h-11">
                <Link to="/app">Open DashForge <ArrowRight className="h-4 w-4 ml-1" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>© 2026 DashForge. Built with care.</div>
          <div className="flex gap-5">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
