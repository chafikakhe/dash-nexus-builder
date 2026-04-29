import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, ArrowUp, Wand2, Database, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const suggestions = [
  { icon: BarChart3, label: "Build me a revenue dashboard from Stripe data" },
  { icon: Database, label: "Generate a customer schema with relations" },
  { icon: Wand2, label: "Suggest 5 widgets for a SaaS support team" },
];

export default function AIStudio() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      {
        role: "assistant",
        content:
          "I'd build a 4-widget dashboard:\n\n1. **MRR stat card** – sum(orders.mrr where active=true)\n2. **Revenue trend** – line chart, last 30 days\n3. **Top customers** – table sorted by MRR desc\n4. **Plan distribution** – pie chart by plan\n\nWant me to create it now?",
      },
    ]);
    setInput("");
  };

  return (
    <>
      <Topbar breadcrumb={[{ label: "Acme Inc." }, { label: "AI Studio" }]} />
      <main className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-2xl mx-auto px-5 py-10">
            {messages.length === 0 ? (
              <div className="text-center animate-fade-in">
                <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-primary shadow-glow grid place-items-center mb-4">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">What should we build?</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  Describe a dashboard, schema, or query in plain English. DashForge AI will generate it for you.
                </p>
                <div className="grid sm:grid-cols-3 gap-2 mt-8 text-left">
                  {suggestions.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => send(s.label)}
                      className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all text-left group"
                    >
                      <s.icon className="h-3.5 w-3.5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
                    {m.role === "assistant" && (
                      <div className="h-7 w-7 rounded-md bg-gradient-primary grid place-items-center shrink-0 shadow-glow">
                        <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap max-w-[80%]",
                        m.role === "user"
                          ? "bg-gradient-primary text-primary-foreground shadow-glow"
                          : "bg-card border border-border"
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {messages[messages.length - 1]?.role === "assistant" && (
                  <div className="flex gap-2 pl-10">
                    <Button size="sm" className="bg-gradient-primary shadow-glow gap-1.5"><Wand2 className="h-3.5 w-3.5" />Create dashboard</Button>
                    <Button size="sm" variant="outline">Refine</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-background/80 backdrop-blur-xl p-4">
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="relative rounded-xl border border-border bg-card focus-within:border-primary/60 focus-within:shadow-glow transition-all"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                rows={2}
                placeholder="Ask DashForge AI to build something…"
                className="w-full bg-transparent resize-none px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none scrollbar-thin"
              />
              <div className="flex items-center justify-between px-3 pb-2">
                <span className="text-[10px] text-muted-foreground">Claude · ⏎ to send</span>
                <Button size="icon" type="submit" className="h-7 w-7 rounded-md bg-gradient-primary shadow-glow">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
