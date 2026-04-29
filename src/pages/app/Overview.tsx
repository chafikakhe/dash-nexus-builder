import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, TrendingUp, Users, DollarSign, Zap, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, CartesianGrid,
} from "recharts";

const series = Array.from({ length: 14 }).map((_, i) => ({
  d: `D${i + 1}`,
  rev: Math.round(2200 + Math.sin(i / 2) * 600 + i * 120),
  users: Math.round(800 + Math.cos(i / 1.5) * 200 + i * 40),
}));

const stats = [
  { label: "Monthly revenue", value: "$48,290", delta: "+12.4%", icon: DollarSign },
  { label: "Active users", value: "12,841", delta: "+3.1%", icon: Users },
  { label: "Conversion rate", value: "4.82%", delta: "+0.6%", icon: TrendingUp },
  { label: "API calls", value: "1.24M", delta: "+18%", icon: Zap },
];

const recent = [
  { name: "Revenue overview", updated: "2 min ago", widgets: 8 },
  { name: "Customer health", updated: "1 hr ago", widgets: 12 },
  { name: "Product analytics", updated: "Yesterday", widgets: 6 },
  { name: "Support queue", updated: "2 days ago", widgets: 4 },
];

export default function Overview() {
  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Acme Inc." }, { label: "Overview" }]}
        actions={
          <Button size="sm" asChild className="bg-gradient-primary shadow-glow">
            <Link to="/app/dashboards/new"><Plus className="h-3.5 w-3.5 mr-1.5" />New dashboard</Link>
          </Button>
        }
      />
      <main className="flex-1 p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Good evening, Jane 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">Here's what's happening across your workspace.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <div className="h-7 w-7 rounded-md bg-secondary grid place-items-center group-hover:bg-gradient-primary/15 transition-colors">
                  <s.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
              <div className="text-2xl font-bold mt-2 tracking-tight">{s.value}</div>
              <div className="text-xs text-success mt-0.5">{s.delta} vs last week</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Revenue</h3>
                <p className="text-xs text-muted-foreground">Last 14 days</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs">View report <ArrowUpRight className="h-3 w-3 ml-1" /></Button>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="d" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="rev" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="font-semibold">Active users</h3>
              <p className="text-xs text-muted-foreground">Daily</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="d" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent dashboards */}
        <div className="rounded-xl border border-border bg-card">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Recent dashboards</h3>
            <Link to="/app/dashboards" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {recent.map((r) => (
              <Link
                to="/app/dashboards/new"
                key={r.name}
                className="flex items-center px-5 py-3 hover:bg-secondary/40 transition-colors group"
              >
                <div className="h-8 w-8 rounded-md bg-gradient-primary/15 border border-primary/20 grid place-items-center mr-3">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.widgets} widgets · updated {r.updated}</div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
