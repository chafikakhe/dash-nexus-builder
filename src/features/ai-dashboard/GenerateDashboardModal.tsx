import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateDashboardWithAI, type GeneratedDashboardWidget } from "./generateDashboard";

type GenerateDashboardModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | null;
  dashboardId: string | null;
  onSuccess: (widgets: GeneratedDashboardWidget[]) => void | Promise<void>;
};

const examplePrompts = [
  "Create a sales dashboard with revenue stats, monthly chart, and top customers table",
  "Build an operations dashboard with open items, status breakdown, and recent records",
  "Generate an executive overview with total count, trend chart, category pie chart, and detail table",
];

export function GenerateDashboardModal({
  open,
  onOpenChange,
  orgId,
  dashboardId,
  onSuccess,
}: GenerateDashboardModalProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canGenerate = useMemo(
    () => Boolean(orgId && dashboardId && prompt.trim().length >= 10 && !loading),
    [dashboardId, loading, orgId, prompt]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (loading) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setError(null);
      setSuccess(null);
    }
  };

  const handleGenerate = async () => {
    if (!orgId || !dashboardId) {
      setError("Save this dashboard before generating widgets.");
      return;
    }

    const cleanedPrompt = prompt.trim();
    if (cleanedPrompt.length < 10) {
      setError("Describe the dashboard you want in a little more detail.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const widgets = await generateDashboardWithAI({
        orgId,
        dashboardId,
        prompt: cleanedPrompt,
      });
      setSuccess(`Generated ${widgets.length} widget${widgets.length === 1 ? "" : "s"}.`);
      await onSuccess(widgets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate dashboard.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate with AI
          </DialogTitle>
          <DialogDescription>
            Describe the dashboard you want. AI will generate validated widget JSON using your workspace collections.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Create a sales dashboard with revenue stats, monthly chart, and top customers table"
            className="min-h-32 resize-none"
            disabled={loading}
          />

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Examples</div>
            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((example) => (
                <Button
                  key={example}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto whitespace-normal px-2.5 py-1.5 text-left text-xs"
                  disabled={loading}
                  onClick={() => setPrompt(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              {success}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleGenerate} disabled={!canGenerate} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
