/**
 * INTEGRATION EXAMPLE
 * 
 * This file shows exactly how to integrate the new workspace bootstrap
 * system into your existing application.
 * 
 * The main changes are:
 * 1. AuthContext now only handles auth state (user, session)
 * 2. WorkspaceContext handles workspace state (active workspace, workspace list)
 * 3. WorkspaceProvider wraps your app (inside AuthProvider)
 */

// ============================================================================
// 1. UPDATE YOUR APP.TSX OR MAIN LAYOUT
// ============================================================================

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";

// Your pages
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import Invite from "@/pages/Invite";

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
      <Toaster position="top-right" richColors />
    </Router>
  );
}

/**
 * Separate component that uses AuthContext
 * This allows us to wrap WorkspaceProvider inside AuthProvider
 */
function AuthenticatedApp() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Unauthenticated routes
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/invite/:token" element={<Invite />} />
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // Authenticated routes - wrap with WorkspaceProvider
  return (
    <WorkspaceProvider user={user}>
      <AuthenticatedRoutes />
    </WorkspaceProvider>
  );
}

/**
 * All authenticated routes
 * Now can use useWorkspace() hook
 */
function AuthenticatedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/invite/:token" element={<Invite />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// ============================================================================
// 2. UPDATE YOUR INDEX PAGE (src/pages/Index.tsx)
// ============================================================================

import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const { activeWorkspace, loading, workspaces, createWorkspace } = useWorkspace();
  const navigate = useNavigate();

  // Handle the loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // This should never happen now (WorkspaceProvider creates default workspace)
  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Create your first workspace</h1>
          <p className="text-muted-foreground">Get started by creating a workspace</p>
          <button
            onClick={async () => {
              try {
                const workspace = await createWorkspace("My Workspace");
                // WorkspaceContext will handle switching to it
              } catch (error) {
                console.error("Error creating workspace:", error);
              }
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Create Workspace
          </button>
        </div>
      </div>
    );
  }

  // Render app with active workspace
  return <AppLayout />;
}

// ============================================================================
// 3. UPDATE YOUR LAYOUT COMPONENT (src/components/layout/AppLayout.tsx)
// ============================================================================

import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Topbar } from "@/components/layout/Topbar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Routes, Route } from "react-router-dom";

// Your app pages
import AdminRoute from "@/components/auth/AdminRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Overview from "@/pages/app/Overview";
import Collections from "@/pages/app/Collections";
import Dashboards from "@/pages/app/Dashboards";
import AIStudio from "@/pages/app/AIStudio";
import Builder from "@/pages/app/Builder";
import Activity from "@/pages/app/Activity";
import Members from "@/pages/app/Members";
import Notifications from "@/pages/app/Notifications";
import Settings from "@/pages/app/Settings";

export function AppLayout() {
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace();

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - pass workspace switching capability */}
      <AppSidebar
        activeWorkspace={activeWorkspace}
        workspaces={workspaces}
        onSwitchWorkspace={switchWorkspace}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar - pass active workspace info */}
        <Topbar workspace={activeWorkspace} />

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/dashboards" element={<Dashboards />} />
            <Route path="/studio" element={<AIStudio />} />
            <Route path="/builder/:id" element={<Builder />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/members" element={<Members />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route
              path="/admin/*"
              element={
                <AdminRoute>
                  <Routes>
                    <Route path="/" element={<Settings />} />
                  </Routes>
                </AdminRoute>
              }
            />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// 4. UPDATE YOUR SIDEBAR (src/components/layout/AppSidebar.tsx)
// ============================================================================

import { useState } from "react";
import { useWorkspace, type Workspace } from "@/contexts/WorkspaceContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus } from "lucide-react";

type AppSidebarProps = {
  activeWorkspace: Workspace;
  workspaces: Workspace[];
  onSwitchWorkspace: (orgId: string) => Promise<void>;
};

export function AppSidebar({
  activeWorkspace,
  workspaces,
  onSwitchWorkspace,
}: AppSidebarProps) {
  const { createWorkspace } = useWorkspace();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWorkspace = async () => {
    setIsCreating(true);
    try {
      const date = new Date().toLocaleDateString();
      await createWorkspace(`Workspace - ${date}`);
    } catch (error) {
      console.error("Error creating workspace:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col">
      {/* Workspace selector */}
      <div className="p-4 border-b border-border">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full">
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
              <div className="text-left flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">
                  {activeWorkspace.org_name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {activeWorkspace.role}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.org_id}
                onClick={() => onSwitchWorkspace(workspace.org_id)}
                className={activeWorkspace.org_id === workspace.org_id ? "bg-secondary" : ""}
              >
                <div className="flex-1">
                  <div className="font-medium">{workspace.org_name}</div>
                  <div className="text-xs text-muted-foreground">{workspace.role}</div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCreateWorkspace} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? "Creating..." : "New workspace"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation items (your existing sidebar items) */}
      <nav className="flex-1 overflow-auto p-4 space-y-2">
        {/* Your sidebar navigation */}
      </nav>
    </aside>
  );
}

// ============================================================================
// 5. USAGE IN ANY COMPONENT
// ============================================================================

import { useWorkspace } from "@/contexts/WorkspaceContext";

function MyComponent() {
  const { activeWorkspace, workspaces, switchWorkspace, createWorkspace } = useWorkspace();

  // Use workspace data in your component
  return (
    <div>
      <h1>Current workspace: {activeWorkspace?.org_name}</h1>
      <p>Role: {activeWorkspace?.role}</p>
      <p>Total workspaces: {workspaces.length}</p>
    </div>
  );
}

// ============================================================================
// SUMMARY OF CHANGES
// ============================================================================

/**
 * Key Integration Points:
 * 
 * 1. APP.TSX
 *    - Keep AuthProvider at root
 *    - Add WorkspaceProvider inside AuthProvider (after auth state is loaded)
 *    - Only show authenticated routes if user exists
 * 
 * 2. PAGES
 *    - Use useWorkspace() to get activeWorkspace
 *    - Use WorkspaceProvider for automatic workspace creation/detection
 *    - Never show "No workspace" (provider creates default)
 * 
 * 3. COMPONENTS
 *    - Pass workspace to child components (workspace prop or context)
 *    - Use switchWorkspace() from context for workspace switching
 *    - Use createWorkspace() for new workspace creation
 * 
 * 4. MEMBERS PAGE
 *    - Already updated to use fetchOrgInvitations() RPC
 *    - Uses new workspace-queries.ts functions
 *    - Should now load invitations correctly
 * 
 * 5. BENEFITS
 *    - No more "No workspace" errors
 *    - Automatic owner assignment when creating workspace
 *    - Active workspace persisted to database
 *    - Clean separation of auth and workspace concerns
 *    - Members page works correctly
 *    - Production-ready architecture
 */
