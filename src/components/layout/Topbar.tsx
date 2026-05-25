import { Search, Command as CmdIcon } from "lucide-react";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/contexts/AuthContext";
import { InvitationNotificationBadge } from "@/components/invitations/InvitationNotificationBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopbarProps {
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function Topbar({ title, breadcrumb, actions }: TopbarProps) {
  const setPaletteOpen = useAppStore((s) => s.setPaletteOpen);
  const { user, signOut } = useAuth();
  
  const displayName = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "User";
  const userInitial = user?.email?.[0].toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-20 h-14 flex items-center gap-3 px-5 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="flex-1 min-w-0">
        {breadcrumb ? (
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-border">/</span>}
                <span className={i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}>{b.label}</span>
              </span>
            ))}
          </nav>
        ) : (
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        )}
      </div>

      <button
        onClick={() => setPaletteOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 h-8 rounded-md border border-border/70 bg-secondary/40 hover:bg-secondary text-xs text-muted-foreground transition-colors w-72"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search or jump to…</span>
        <span className="ml-auto flex items-center gap-0.5 text-[10px]">
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-background/60 font-mono">⌘</kbd>
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-background/60 font-mono">K</kbd>
        </span>
      </button>

      {actions}

      <InvitationNotificationBadge />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-8 w-8 rounded-full bg-gradient-primary grid place-items-center text-xs font-bold text-primary-foreground shadow-glow">
            {userInitial}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>
            <div className="text-sm font-medium">{displayName}</div>
            <div className="text-xs text-muted-foreground font-normal">{user?.email ?? "—"}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Billing</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPaletteOpen(true)}>
            <CmdIcon className="h-3.5 w-3.5 mr-2" /> Command palette
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={signOut}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
