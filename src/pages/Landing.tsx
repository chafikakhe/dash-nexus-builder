import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  PlayCircle,
  Sparkles,
  WandSparkles,
  Layers,
  Gauge,
  ShieldCheck,
  Crown,
  Rocket,
  Grip,
  BarChart3,
  Activity,
  Brain,
  MousePointer2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

const trustStats = [
  { label: "Dashboards shipped", value: 18240, suffix: "+" },
  { label: "Teams onboarded", value: 3200, suffix: "+" },
  { label: "Avg speed gain", value: 71, suffix: "%" },
];

const testimonials = [
  {
    quote: "We replaced three tools in one week. The motion-rich UI helped our exec team actually adopt analytics.",
    author: "Maya Kim",
    role: "VP Operations, FluxDrive",
  },
  {
    quote: "It feels like an Apple product page turned into a builder. Conversion jumped right after launch.",
    author: "Noah Patel",
    role: "Growth Lead, ThunderGrid",
  },
  {
    quote: "From prompt to production dashboard in minutes. It genuinely feels magical.",
    author: "Sofia Rami",
    role: "Head of Data, VelocityCore",
  },
];

const features = [
  {
    title: "Narrative Analytics",
    body: "Tell data stories with cinematic blocks, dynamic highlights, and contextual AI notes.",
    icon: Brain,
    tone: "from-violet-500/20 to-indigo-500/10",
    demo: [44, 58, 49, 70, 82, 76, 95],
  },
  {
    title: "Neon Live Charts",
    body: "Pulse-aware chart layers that animate with live metrics and confidence bands.",
    icon: Activity,
    tone: "from-violet-500/20 to-purple-500/20",
    demo: [30, 40, 55, 50, 70, 65, 85],
  },
  {
    title: "Luxury Permissions",
    body: "Enterprise-grade roles with clean admin controls and audit-safe action trails.",
    icon: ShieldCheck,
    tone: "from-violet-500/20 to-indigo-500/20",
    demo: [60, 70, 65, 72, 85, 88, 92],
  },
  {
    title: "Motion Builder",
    body: "Drag widgets into place with magnetic snapping and premium depth interactions.",
    icon: Grip,
    tone: "from-violet-500/20 to-indigo-500/10",
    demo: [20, 30, 46, 62, 75, 68, 80],
  },
];

function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let current = 0;
    const step = Math.max(1, Math.ceil(value / 65));
    const id = setInterval(() => {
      current += step;
      if (current >= value) {
        setCount(value);
        clearInterval(id);
      } else {
        setCount(current);
      }
    }, 16);

    return () => clearInterval(id);
  }, [value]);

  return (
    <span>
      {Intl.NumberFormat("en-US").format(count)}
      {suffix}
    </span>
  );
}

function SectionReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 42 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function HeroVisual() {
  const [activePoint, setActivePoint] = useState(5);

  useEffect(() => {
    const id = setInterval(() => {
      setActivePoint((p) => (p + 1) % 12);
    }, 900);

    return () => clearInterval(id);
  }, []);

  const bars = [42, 60, 48, 80, 73, 92, 69, 88, 78, 95, 84, 100];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="relative mx-auto mt-14 max-w-6xl"
    >
      <motion.div
        animate={{ rotate: [0, 1.2, 0, -1.2, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        className="absolute -inset-20 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.22),rgba(0,0,0,0)_58%)] blur-3xl"
      />

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_40px_120px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-300/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-300/90" />
            <span className="ml-2 text-xs text-zinc-400">nexus-builder / cinematic-revenue</span>
          </div>
          <Badge className="border-violet-400/40 bg-violet-500/20 text-violet-200">Live AI</Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <motion.div
            whileHover={{ y: -5 }}
            className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 lg:col-span-3"
          >
            <p className="text-xs text-zinc-500">Revenue Pulse</p>
            <p className="mt-2 text-3xl font-semibold text-white">$428.5k</p>
            <p className="mt-1 text-xs text-emerald-300">+18.4% from last period</p>
          </motion.div>

          <motion.div
            whileHover={{ y: -5 }}
            className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 lg:col-span-3"
          >
            <p className="text-xs text-zinc-500">Activation Rate</p>
            <p className="mt-2 text-3xl font-semibold text-white">68.2%</p>
            <p className="mt-1 text-xs text-violet-300">AI optimized funnel path</p>
          </motion.div>

          <div className="relative overflow-hidden rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-indigo-500/10 p-4 lg:col-span-6 lg:row-span-2">
            <p className="mb-4 text-xs text-zinc-300">Generated Trend Graph</p>
            <div className="flex h-44 items-end gap-1">
              {bars.map((height, index) => (
                <motion.div
                  key={index}
                  animate={{ height: `${height}%`, opacity: activePoint === index ? 1 : 0.55 }}
                  transition={{ duration: 0.5 }}
                  className="relative flex-1 rounded-sm bg-gradient-to-t from-violet-600 via-purple-500 to-indigo-300 shadow-[0_0_22px_rgba(124,58,237,0.45)]"
                >
                  {activePoint === index && (
                    <motion.span
                      layoutId="spark"
                      className="absolute -top-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,1)]"
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 lg:col-span-6">
            <p className="text-xs text-zinc-500">AI Generation Stream</p>
            <div className="mt-3 space-y-2">
              {["Reading source tables", "Designing KPI layout", "Rendering responsive components"].map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.4 }}
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300"
                >
                  {item}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [promptStep, setPromptStep] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();

  const yOne = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const yTwo = useTransform(scrollYProgress, [0, 1], [0, -250]);

  const spot = useMotionTemplate`radial-gradient(500px circle at ${mouseX}px ${mouseY}px, rgba(124,58,237,0.22), transparent 45%)`;

  useEffect(() => {
    const id = setInterval(() => {
      setPromptStep((prev) => (prev + 1) % 4);
    }, 1200);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const promptStates = useMemo(
    () => [
      "Parsing prompt intent...",
      "Assembling metrics and filters...",
      "Generating cinematic dashboard layout...",
      "Dashboard ready. Launching preview.",
    ],
    [],
  );

  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goSignIn = () => navigate("/auth");
  const goStartFree = () => navigate("/auth");
  const goOpenApp = () => navigate(user ? "/app" : "/auth");
  const goGenerateDashboard = () => navigate(user ? "/app/dashboards" : "/auth");
  const goAIStudio = () => navigate(user ? "/app/ai-studio" : "/auth");
  const goWatchDemo = () => scrollToSection("demo");

  return (
    <div
      onMouseMove={(e) => {
        mouseX.set(e.clientX);
        mouseY.set(e.clientY);
      }}
      className="relative min-h-screen overflow-x-hidden bg-[#05060A] text-white"
    >
      <motion.div style={{ backgroundImage: spot }} className="pointer-events-none fixed inset-0 z-10" />
      <motion.div style={{ y: yOne }} className="pointer-events-none fixed -top-32 left-1/4 z-0 h-96 w-96 rounded-full bg-violet-600/16 blur-[140px]" />
      <motion.div style={{ y: yTwo }} className="pointer-events-none fixed -bottom-48 right-10 z-0 h-[32rem] w-[32rem] rounded-full bg-indigo-600/14 blur-[150px]" />

      <header
        className={`fixed left-0 right-0 top-0 z-50 border-b border-white/5 transition-all duration-300 ${
          scrolled ? "bg-black/30 backdrop-blur-lg" : "bg-transparent backdrop-blur-md"
        }`}
      >
        <div className="container flex h-16 items-center">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-violet-300/30 bg-violet-500/20">
              <Sparkles className="h-4 w-4 text-violet-200" />
            </span>
            <span className="text-sm font-semibold tracking-[0.18em] text-zinc-200">DASH NEXUS</span>
          </Link>

          <nav className="ml-10 hidden items-center gap-7 text-sm text-zinc-400 md:flex">
            <button type="button" aria-label="Go to features section" onClick={() => scrollToSection("features")} className="cursor-pointer transition hover:text-zinc-100">Features</button>
            <button type="button" aria-label="Open AI Studio" onClick={goAIStudio} className="cursor-pointer transition hover:text-zinc-100">AI Studio</button>
            <button type="button" aria-label="Go to builder section" onClick={() => scrollToSection("builder")} className="cursor-pointer transition hover:text-zinc-100">Builder</button>
            <button type="button" aria-label="Go to launch section" onClick={() => scrollToSection("launch")} className="cursor-pointer transition hover:text-zinc-100">Launch</button>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button type="button" aria-label="Sign in" onClick={goSignIn} variant="ghost" className="cursor-pointer text-zinc-200 hover:bg-white/10 hover:text-white">
              Sign In
            </Button>
            <Button type="button" aria-label="Start free" onClick={goStartFree} className="cursor-pointer border border-violet-300/25 bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-[0_0_34px_rgba(124,58,237,0.35)]">
              Start Free <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <section className="relative min-h-screen overflow-hidden pb-24 pt-20 md:pt-24">
        <div className="pointer-events-none absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="Management analytics dashboard background video"
            className="absolute inset-0 z-0 h-full w-full object-cover opacity-40"
          >
            <source src="/videos/hero-background.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 z-10 bg-black/60" />
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/30 via-purple-950/20 to-black" />
        </div>

        <div className="container relative z-20">
          <SectionReveal>
            <div className="mx-auto max-w-4xl text-center">
              <Badge className="mb-6 border-violet-400/30 bg-violet-500/15 px-4 py-1 text-violet-200">
                Cinematic Dashboard Intelligence
              </Badge>
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9 }}
                className="text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl md:text-7xl"
              >
                Build dashboards at the speed of thought.
                <span className="mt-3 block bg-gradient-to-r from-white via-zinc-100 to-violet-300 bg-clip-text text-transparent">
                  AI dashboards that feel magical.
                </span>
              </motion.h1>
              <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-300 md:text-lg">
                Premium SaaS design language meets real-time analytics. Craft data experiences with layered depth, dramatic motion, and conversion-first storytelling.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Button type="button" aria-label="Generate dashboard" onClick={goGenerateDashboard} size="lg" className="h-12 cursor-pointer border border-violet-300/30 bg-gradient-to-r from-violet-600 to-purple-500 px-7 text-base shadow-[0_0_42px_rgba(124,58,237,0.4)]">
                  Generate Dashboard
                </Button>
                <Button type="button" aria-label="Watch demo" onClick={goWatchDemo} size="lg" variant="outline" className="h-12 cursor-pointer border-white/20 bg-white/5 px-7 text-base text-zinc-100 hover:bg-white/10">
                  <PlayCircle className="mr-2 h-4 w-4" />Watch Demo
                </Button>
                <Button type="button" aria-label="Start free from hero" onClick={goStartFree} size="lg" variant="ghost" className="h-12 cursor-pointer px-7 text-base text-zinc-200 hover:bg-white/10">
                  Start Free
                </Button>
              </div>
            </div>
          </SectionReveal>

          <HeroVisual />
        </div>
      </section>

      <section id="demo" className="relative z-20 py-16">
        <div className="container">
          <SectionReveal>
            <div className="rounded-2xl border border-white/10 bg-black/35 p-6 md:p-8">
              <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Demo</p>
              <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Interactive product demo preview.</h2>
              <p className="mt-3 max-w-2xl text-zinc-300">See how AI generation, dashboard assembly, and widget editing flow together in a single premium builder experience.</p>
              <div className="mt-6">
                <Button type="button" aria-label="Open app demo" onClick={goOpenApp} className="cursor-pointer border border-violet-300/25 bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-[0_0_34px_rgba(124,58,237,0.35)]">
                  Open app
                </Button>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      <section className="relative z-20 border-y border-white/10 bg-white/[0.02] py-12">
        <div className="container grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <SectionReveal>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Trusted Momentum</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {trustStats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-2xl font-semibold text-white"><CountUp value={stat.value} suffix={stat.suffix} /></p>
                    <p className="mt-1 text-xs text-zinc-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </SectionReveal>
          <SectionReveal delay={0.1}>
            <div className="grid gap-3 sm:grid-cols-3">
              {[Crown, Rocket, ShieldCheck].map((Icon, index) => (
                <motion.div
                  whileHover={{ y: -4 }}
                  key={index}
                  className="rounded-xl border border-violet-400/20 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4"
                >
                  <Icon className="h-5 w-5 text-violet-200" />
                  <p className="mt-3 text-sm text-zinc-300">Premium-grade reliability</p>
                </motion.div>
              ))}
            </div>
          </SectionReveal>
        </div>

        <div className="container mt-8 grid gap-4 md:grid-cols-3">
          {testimonials.map((item, i) => (
            <SectionReveal key={item.author} delay={i * 0.1}>
              <motion.div whileHover={{ y: -4 }} className="h-full rounded-xl border border-white/10 bg-black/35 p-5">
                <p className="text-sm text-zinc-300">{item.quote}</p>
                <p className="mt-4 text-sm font-medium text-white">{item.author}</p>
                <p className="text-xs text-zinc-500">{item.role}</p>
              </motion.div>
            </SectionReveal>
          ))}
        </div>
      </section>

      <section id="features" className="relative z-20 py-24">
        <div className="container">
          <SectionReveal>
            <div className="mb-12 max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Feature Architecture</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">A cinematic bento grid engineered for conversion.</h2>
            </div>
          </SectionReveal>

          <div className="grid gap-4 md:grid-cols-2">
            {features.map((item, i) => (
              <SectionReveal key={item.title} delay={i * 0.07}>
                <motion.div
                  whileHover={{ y: -6, scale: 1.01 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6"
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.tone} opacity-70`} />
                  <div className="relative">
                    <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                      <item.icon className="h-5 w-5 text-violet-100" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 max-w-md text-sm text-zinc-300">{item.body}</p>
                    <div className="mt-6 flex h-20 items-end gap-1">
                      {item.demo.map((h, idx) => (
                        <motion.div
                          key={idx}
                          whileHover={{ opacity: 1 }}
                          className="flex-1 rounded-sm bg-gradient-to-t from-violet-500 to-indigo-300 opacity-80"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="ai" className="relative z-20 py-24">
        <div className="container grid gap-10 lg:grid-cols-2 lg:items-center">
          <SectionReveal>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-violet-200">AI Generation</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">Prompt to cinematic dashboard, in one intelligent flow.</h2>
              <p className="mt-4 max-w-xl text-zinc-300">Type what you need. The AI engine composes metrics, selects widgets, animates hierarchy, and ships a ready-to-present dashboard with narrative structure.</p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-sm text-violet-100">
                <WandSparkles className="h-4 w-4" />
                Create a sales dashboard with revenue trends
              </div>
            </div>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-zinc-300">AI Output Sequence</p>
                <Badge className="border-violet-400/30 bg-violet-500/20 text-violet-100">Neural Render</Badge>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={promptStep}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.45 }}
                  className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-zinc-200"
                >
                  {promptStates[promptStep]}
                </motion.div>
              </AnimatePresence>

              <div className="mt-5 grid grid-cols-6 gap-2 rounded-xl border border-white/10 bg-zinc-950/70 p-3">
                {[38, 48, 60, 54, 72, 88].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [`${h - 10}%`, `${h}%`, `${h - 6}%`] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.1 }}
                    className="rounded-sm bg-gradient-to-t from-violet-600 via-purple-500 to-indigo-200"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      <section id="builder" className="relative z-20 py-24">
        <div className="container">
          <SectionReveal>
            <div className="mb-10 max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Dashboard Builder</p>
              <h2 className="mt-3 text-4xl font-semibold text-white md:text-5xl">Drag, drop, and direct the story with precision motion.</h2>
            </div>
          </SectionReveal>

          <SectionReveal delay={0.1}>
            <motion.div whileHover={{ scale: 1.01 }} className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/45 p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.22),transparent_36%),radial-gradient(circle_at_80%_70%,rgba(244,63,94,0.2),transparent_40%)]" />
              <div className="relative grid gap-4 lg:grid-cols-12">
                <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-4 lg:col-span-3">
                  <p className="mb-3 text-xs text-zinc-400">Widget Stack</p>
                  <div className="space-y-2">
                    {["Revenue", "Conversion", "Retention", "Pipeline"].map((w) => (
                      <motion.div key={w} whileHover={{ x: 4 }} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                        <MousePointer2 className="h-3.5 w-3.5 text-violet-200" />
                        {w}
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-4 lg:col-span-6">
                  <p className="mb-3 text-xs text-zinc-400">Live Canvas Grid</p>
                  <div className="grid h-64 grid-cols-6 gap-2 rounded-xl border border-white/10 bg-black/35 p-2">
                    <motion.div drag dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }} className="col-span-3 rounded-lg border border-violet-300/30 bg-violet-500/15 p-2 text-xs text-violet-100">
                      <BarChart3 className="mb-1 h-4 w-4" />
                      KPI Trend
                    </motion.div>
                    <motion.div drag dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }} className="col-span-3 rounded-lg border border-indigo-300/30 bg-indigo-500/15 p-2 text-xs text-indigo-100">
                      <Gauge className="mb-1 h-4 w-4" />
                      Goal Meter
                    </motion.div>
                    <motion.div drag dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }} className="col-span-6 rounded-lg border border-violet-300/30 bg-violet-500/15 p-2 text-xs text-violet-100">
                      <Layers className="mb-1 h-4 w-4" />
                      Executive Summary Panel
                    </motion.div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-4 lg:col-span-3">
                  <p className="mb-3 text-xs text-zinc-400">Realtime Diagnostics</p>
                  <div className="space-y-2 text-sm text-zinc-300">
                    {["Widget snapping: active", "Auto-layout: optimized", "Render latency: 32ms"].map((item, i) => (
                      <motion.div
                        key={item}
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                        className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                      >
                        {item}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </SectionReveal>
        </div>
      </section>

      <section id="launch" className="relative z-20 py-24">
        <div className="container">
          <SectionReveal>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0A0B14] via-violet-950/25 to-[#11131F] p-10 text-center md:p-14">
              <motion.div
                animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.05, 1] }}
                transition={{ duration: 4.5, repeat: Infinity }}
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(124,58,237,0.28),transparent_55%)]"
              />
              <div className="relative">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-300">Launch Your Next Story</p>
                <h2 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">Command attention with every dashboard reveal.</h2>
                <p className="mx-auto mt-5 max-w-2xl text-zinc-300">From first impression to investor demo, build premium analytics experiences that convert users and accelerate decision-making.</p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Button type="button" aria-label="Start free from launch section" onClick={goStartFree} size="lg" className="h-12 cursor-pointer border border-violet-300/30 bg-gradient-to-r from-violet-600 to-purple-500 px-8 text-base shadow-[0_0_48px_rgba(124,58,237,0.45)]">
                    Start Free
                  </Button>
                  <Button type="button" aria-label="Generate dashboard from launch section" onClick={goGenerateDashboard} size="lg" variant="outline" className="h-12 cursor-pointer border-white/20 bg-white/5 px-8 text-base text-zinc-100 hover:bg-white/10">
                    Generate Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      <footer className="relative z-20 border-t border-white/10 py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-sm text-zinc-500 md:flex-row">
          <p>© 2026 Dash Nexus. Precision-built for cinematic analytics.</p>
          <div className="flex items-center gap-5">
            <a href="#" className="transition hover:text-zinc-200">Privacy</a>
            <a href="#" className="transition hover:text-zinc-200">Terms</a>
            <a href="#" className="transition hover:text-zinc-200">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
