import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowRight } from "lucide-react";

export default function Login() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm animate-fade-in">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg mb-10">
            <div className="h-8 w-8 rounded-md bg-gradient-primary grid place-items-center shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            DashForge
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your DashForge workspace.</p>

          <div className="mt-8 space-y-3">
            <Button variant="outline" className="w-full h-10 gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1H12v3.9h5.35c-.25 1.55-1.85 4.55-5.35 4.55-3.2 0-5.85-2.65-5.85-5.95s2.65-5.95 5.85-5.95c1.85 0 3.05.8 3.75 1.5l2.55-2.45C16.65 4.85 14.6 4 12 4 6.95 4 3 7.95 3 13s3.95 9 9 9c5.2 0 8.65-3.65 8.65-8.8 0-.6-.05-1.05-.15-1.55Z"/></svg>
              Continue with Google
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted-foreground">or</span></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="you@company.com" /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" placeholder="••••••••" /></div>
            <Button asChild className="w-full bg-gradient-primary shadow-glow h-10">
              <Link to="/app">Sign in <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-4">
              Don't have an account? <a href="#" className="text-primary hover:underline">Sign up</a>
            </p>
          </div>
        </div>
      </div>

      {/* Visual */}
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
