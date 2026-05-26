import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, BarChart3, Bot, Database, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sendAIStudioMessage, type AIStudioMessage } from "@/features/ai-studio/chat";
import { generateDashboardWithAI } from "@/features/ai-dashboard/generateDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboards } from "@/hooks/useDashboards";
import { useCollections } from "@/hooks/useCollections";

const suggestions = [
  { icon: BarChart3, label: "Build me a revenue dashboard from Stripe-style subscription data" },
  { icon: Database, label: "Create a dashboard to present my customer success collection" },
  { icon: Wand2, label: "Generate an operations dashboard with open issues, SLA risk, and recent activity" },
];

function shouldCreateDashboardFromPrompt(prompt: string) {
  return /\b(build|create|generate)\b.*\b(dashboard|widgets?)\b|\bdashboard\b|\bwidgets?\b|\bchart\b/i.test(prompt);
}

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toDashboardName(prompt: string, collectionNames: string[]) {
  const normalizedPrompt = prompt.toLowerCase();
  const matchedCollection = [...collectionNames]
    .sort((a, b) => b.length - a.length)
    .find((name) => normalizedPrompt.includes(name.toLowerCase()));

  if (matchedCollection) {
    return `${toTitleCase(matchedCollection)} Overview`;
  }

  if (/\brevenue|sales|mrr|stripe\b/i.test(prompt)) return "Revenue Overview";
  if (/\bcustomer success|support\b/i.test(prompt)) return "Customer Success Overview";
  if (/\boperations|sla|issues?\b/i.test(prompt)) return "Operations Overview";
  if (/\bemployee|hr|salary|payroll\b/i.test(prompt)) return "Workforce Overview";

  const cleaned = prompt
    .replace(/\s+/g, " ")
    .replace(/^(build|create|generate)\s+(me\s+)?/i, "")
    .replace(/\b(a|an|the)\b/gi, "")
    .replace(/\bdashboard\b/gi, "")
    .replace(/\bfor\b/gi, "")
    .replace(/\bto\b/gi, "")
    .trim();

  if (!cleaned) return "AI Studio Dashboard";

  const title = toTitleCase(cleaned);
  return title.length > 60 ? `${title.slice(0, 57).trim()}...` : title;
}

export default function AIStudio() {
  const navigate = useNavigate();
  const { currentOrgId } = useAuth();
  const { create } = useDashboards();
  const { collections } = useCollections();

  const [messages, setMessages] = useState<AIStudioMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("AI is thinking...");
  const [lastModelNote, setLastModelNote] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const loadingTimersRef = useRef<number[]>([]);
  const cooldownIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      for (const timer of loadingTimersRef.current) {
        window.clearTimeout(timer);
      }
      if (cooldownIntervalRef.current) {
        window.clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  const send = async (text: string) => {
    const cleaned = text.trim();
    if (!cleaned || loading) return;
    if (Date.now() < cooldownUntil) {
      setError("Please wait a few seconds before sending another request.");
      return;
    }

    const nextHistory = [...messages, { role: "user" as const, content: cleaned }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    setError(null);
    setLastModelNote(null);
    setStatusMessage("AI is thinking...");
    setCooldownUntil(Date.now() + 4_000);
    if (cooldownIntervalRef.current) {
      window.clearInterval(cooldownIntervalRef.current);
    }
    cooldownIntervalRef.current = window.setInterval(() => {
      setCooldownUntil((value) => {
        if (value <= Date.now()) {
          if (cooldownIntervalRef.current) {
            window.clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
          return 0;
        }
        return value;
      });
    }, 250);

    for (const timer of loadingTimersRef.current) {
      window.clearTimeout(timer);
    }
    loadingTimersRef.current = [
      window.setTimeout(() => setStatusMessage("AI is currently busy, retrying..."), 1_000),
      window.setTimeout(() => setStatusMessage("Using fallback AI model if needed..."), 3_000),
    ];

    try {
      if (shouldCreateDashboardFromPrompt(cleaned)) {
        if (!currentOrgId) {
          throw new Error("Select a workspace before creating a dashboard.");
        }

        const created = await create({
          name: toDashboardName(cleaned, collections.map((collection) => collection.name)),
          description: "Created from AI Studio",
          layout: [],
        });

        if (!created) {
          throw new Error("Dashboard creation failed before widget generation started.");
        }

        const widgets = await generateDashboardWithAI({
          orgId: currentOrgId,
          dashboardId: created.id,
          prompt: cleaned,
        });

        setMessages([
          ...nextHistory,
          {
            role: "assistant",
            content: `Created "${created.name}" with ${widgets.length} widget${widgets.length === 1 ? "" : "s"}. Opening it now...`,
          },
        ]);

        navigate(`/app/dashboards/${created.id}`);
        return;
      }

      const response = await sendAIStudioMessage({
        message: cleaned,
        history: messages,
      });

      if (response.usedFallback && response.model) {
        setLastModelNote(`Used fallback model: ${response.model}`);
      } else if (response.model) {
        setLastModelNote(`Model: ${response.model}`);
      }

      setMessages([...nextHistory, { role: "assistant", content: response.reply }]);
    } catch (err) {
      setMessages(messages);
      setError(err instanceof Error ? err.message : "Temporary AI overload, please try again.");
    } finally {
      for (const timer of loadingTimersRef.current) {
        window.clearTimeout(timer);
      }
      loadingTimersRef.current = [];
      setLoading(false);
    }
  };

  const cooldownSeconds = cooldownUntil > Date.now() ? Math.ceil((cooldownUntil - Date.now()) / 1000) : 0;

  return (
    <>
      <Topbar breadcrumb={[{ label: "Acme Inc." }, { label: "AI Studio" }]} />
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-2xl px-5 py-10">
            {messages.length === 0 ? (
              <div className="animate-fade-in text-center">
                <div className="mb-4 inline-flex h-12 w-12 place-items-center rounded-xl bg-gradient-primary shadow-glow">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">What should we build?</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ask AI Studio for a dashboard and it will create it directly in your workspace instead of replying with a text-only mockup.
                </p>
                <div className="mt-8 grid gap-2 text-left sm:grid-cols-3">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => void send(suggestion.label)}
                      className="group rounded-lg border border-border bg-card p-3 text-left text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
                    >
                      <suggestion.icon className="mb-2 h-3.5 w-3.5 text-primary transition-transform group-hover:scale-110" />
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={cn("flex gap-3", message.role === "user" && "justify-end")}>
                    {message.role === "assistant" && (
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-primary shadow-glow">
                        <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm",
                        message.role === "user"
                          ? "bg-gradient-primary text-primary-foreground shadow-glow"
                          : "border border-border bg-card"
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {loading ? (
                  <div className="flex gap-3">
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-primary shadow-glow">
                      <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {statusMessage}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-background/80 p-4 backdrop-blur-xl">
          <div className="mx-auto max-w-2xl">
            {error ? (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            {lastModelNote ? (
              <div className="mb-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                {lastModelNote}
              </div>
            ) : null}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
              className="relative rounded-xl border border-border bg-card transition-all focus-within:border-primary/60 focus-within:shadow-glow"
            >
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(input);
                  }
                }}
                rows={2}
                placeholder="Ask AI Studio to create a dashboard directly in your workspace..."
                className="w-full resize-none bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none scrollbar-thin"
                disabled={loading}
              />
              <div className="flex items-center justify-between px-3 pb-2">
                <span className="text-[10px] text-muted-foreground">
                  {cooldownSeconds > 0
                    ? `Please wait ${cooldownSeconds}s before sending another request`
                    : "Google AI Studio · Gemini · direct dashboard creation"}
                </span>
                <Button
                  size="icon"
                  type="submit"
                  disabled={loading || cooldownSeconds > 0 || input.trim().length < 3}
                  className="h-7 w-7 rounded-md bg-gradient-primary shadow-glow"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
