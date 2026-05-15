import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Sparkles,
  Users,
  Send,
  MessagesSquare,
  Network,
  BarChart3,
  Settings,
  Search,
  Bell,
  Command,
  Rocket,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workspace", label: "RM AI Workspace", icon: Sparkles, badge: "AI" },
  { to: "/customers", label: "Customer Intelligence", icon: Users },
  { to: "/outreach", label: "Outreach Center", icon: Send },
  { to: "/campaign", label: "Campaign Builder", icon: Rocket, badge: "NEW" },
  { to: "/conversations", label: "Conversation Console", icon: MessagesSquare },
  { to: "/reasoning", label: "Reasoning & Trace", icon: Network },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Admin & Settings", icon: Settings },
] as const;

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
          <div className="relative w-8 h-8 rounded-lg gradient-primary grid place-items-center shadow-glow">
            <span className="font-display font-bold text-primary-foreground text-sm">B</span>
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-sm">BankingRM</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Agentic CRM</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <div className="px-2 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Workspace
          </div>
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r gradient-primary"
                  />
                )}
                <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && item.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full gradient-primary text-primary-foreground font-semibold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-success pulse-dot" />
              <span className="text-xs font-medium">Agent Online</span>
            </div>
            <div className="text-[10px] text-muted-foreground leading-relaxed">
              Gemini 2.0 Flash · LangGraph v0.2 · 16 tools registered
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 glass-strong border-b border-border flex items-center px-6 gap-4">
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Ask the agent or search customers, products, campaigns…"
                className="w-full bg-input/60 border border-border rounded-lg pl-9 pr-20 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 border border-border px-1.5 py-0.5 rounded">
                <Command className="w-2.5 h-2.5" /> K
              </kbd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 grid place-items-center rounded-lg hover:bg-muted/60 transition">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
            </button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full gradient-primary grid place-items-center text-xs font-semibold text-primary-foreground">
                RM
              </div>
              <div className="hidden md:block leading-tight">
                <div className="text-xs font-medium">Rohan Mehta</div>
                <div className="text-[10px] text-muted-foreground">Senior RM · Mumbai</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
