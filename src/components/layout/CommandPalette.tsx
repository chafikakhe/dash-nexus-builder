import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAppStore } from "@/store/app";
import { LayoutDashboard, Database, Sparkles, Settings, Plus, PanelsTopLeft, Users } from "lucide-react";

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPaletteOpen]);

  const go = (path: string) => {
    setPaletteOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder="Search dashboards, collections, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/app")}><LayoutDashboard className="h-4 w-4 mr-2" />Overview</CommandItem>
          <CommandItem onSelect={() => go("/app/dashboards")}><PanelsTopLeft className="h-4 w-4 mr-2" />Dashboards</CommandItem>
          <CommandItem onSelect={() => go("/app/collections")}><Database className="h-4 w-4 mr-2" />Collections</CommandItem>
          <CommandItem onSelect={() => go("/app/ai")}><Sparkles className="h-4 w-4 mr-2" />AI Studio</CommandItem>
          <CommandItem onSelect={() => go("/app/members")}><Users className="h-4 w-4 mr-2" />Members</CommandItem>
          <CommandItem onSelect={() => go("/app/settings")}><Settings className="h-4 w-4 mr-2" />Settings</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Create">
          <CommandItem onSelect={() => go("/app/dashboards/new")}><Plus className="h-4 w-4 mr-2" />New dashboard</CommandItem>
          <CommandItem onSelect={() => go("/app/collections")}><Plus className="h-4 w-4 mr-2" />New collection</CommandItem>
          <CommandItem onSelect={() => go("/app/ai")}><Sparkles className="h-4 w-4 mr-2" />Generate with AI</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
