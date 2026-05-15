import { useQuery } from "@tanstack/react-query";
import { analytics as analyticsApi, customers as customersApi, type KPIs, type ChartData } from "@/lib/api";
import { kpis as mockKpis, customers as mockCustomers, segmentBreakdown as mockSegments, pipelineStages as mockPipeline, conversionTrend as mockTrend, formatINR } from "@/lib/mockData";
import { motion } from "framer-motion";
import {
  Users, TrendingUp, Flame, Wallet, Send, Activity,
  Sparkles, ArrowUpRight, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis,
  BarChart, Bar, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

const COLORS = ["#5b8bff", "#34d399", "#a78bfa", "#fbbf24", "#f472b6", "#22d3ee"];

export function DashboardPage() {
  const { data: kpiData } = useQuery({
    queryKey: ["kpis"],
    queryFn: analyticsApi.kpis,
    staleTime: 60_000,
  });

  const { data: chartData } = useQuery({
    queryKey: ["charts"],
    queryFn: analyticsApi.charts,
    staleTime: 60_000,
  });

  const { data: recentCustomers } = useQuery({
    queryKey: ["customers", "recent"],
    queryFn: () => customersApi.list({ limit: 6 }),
    staleTime: 60_000,
  });

  const kpis = kpiData ?? mockKpis;
  const segmentBreakdown = chartData?.segmentBreakdown ?? mockSegments;
  const conversionTrend = chartData?.conversionTrend?.length ? chartData.conversionTrend : mockTrend;
  const pipelineStages = chartData?.pipelineStages?.length ? chartData.pipelineStages : mockPipeline;

  const cards = [
    { label: "Total Customers", value: kpis.totalCustomers.toLocaleString(), delta: "+4.2%", icon: Users, accent: "primary" },
    { label: "High-Value Customers", value: kpis.highValue.toLocaleString(), delta: "+8.1%", icon: TrendingUp, accent: "accent" },
    { label: "Hot Leads (AI Scored)", value: kpis.hotLeads.toLocaleString(), delta: "+22 today", icon: Flame, accent: "warning" },
    { label: "Pipeline Value", value: formatINR(kpis.pipelineValue), delta: "+12.4%", icon: Wallet, accent: "primary" },
  ];

  const recommendations = [
    { title: `${Math.round(kpis.hotLeads * 0.4)} customers ready for personal loan upsell`, confidence: 92, type: "Cross-sell" },
    { title: "Re-engage dormant HNI clients in Mumbai", confidence: 84, type: "Retention" },
    { title: `Pre-approved credit upgrade for salaried ${kpis.highValue > 0 ? `(${Math.round(kpis.highValue * 0.22)})` : ""}`, confidence: 78, type: "Campaign" },
  ];

  const activityCustomers = recentCustomers?.items ?? mockCustomers.slice(0, 6);
  const activity = activityCustomers.slice(0, 6).map((c, i) => ({
    name: c.name,
    action: ["replied to outreach", "qualified for loan", "opened campaign", "objection handled by AI", "scheduled call", "moved to CLOSING"][i],
    time: ["2m ago", "8m ago", "21m ago", "44m ago", "1h ago", "2h ago"][i],
    score: "clv_score" in c ? c.clv_score : (c as { conversionScore?: number }).conversionScore ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Real-time view of your portfolio, AI campaigns, and conversion pipeline."
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative glass rounded-xl p-5 overflow-hidden shadow-card group"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition" style={{ background: "var(--gradient-glow)" }} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="mt-2 text-2xl font-display font-semibold tracking-tight">{c.value}</div>
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-success">
                  <ArrowUpRight className="w-3 h-3" />
                  {c.delta}
                </div>
              </div>
              <div className={`w-10 h-10 rounded-lg grid place-items-center ${c.accent === "accent" ? "bg-accent/15 text-accent" : c.accent === "warning" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"}`}>
                <c.icon className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 glass rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold">Conversion Pipeline · 12 months</div>
              <div className="text-xs text-muted-foreground">Outreach sent vs responded vs converted</div>
            </div>
            <div className="flex gap-3 text-xs">
              <Legend dot="#5b8bff" label="Sent" />
              <Legend dot="#a78bfa" label="Responded" />
              <Legend dot="#34d399" label="Converted" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={conversionTrend}>
              <defs>
                <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#5b8bff" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#5b8bff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g3" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="sent" stroke="#5b8bff" fill="url(#g1)" strokeWidth={2} />
              <Area type="monotone" dataKey="responded" stroke="#a78bfa" fill="url(#g3)" strokeWidth={2} />
              <Area type="monotone" dataKey="converted" stroke="#34d399" fill="url(#g2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-5 shadow-card">
          <div className="text-sm font-semibold mb-1">Customer Segments</div>
          <div className="text-xs text-muted-foreground mb-3">Portfolio distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={segmentBreakdown} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {segmentBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {segmentBreakdown.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                <span className="truncate">{s.name}</span>
                <span className="ml-auto text-foreground font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline funnel + AI recommendations */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 glass rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold">Lifecycle Pipeline</div>
              <div className="text-xs text-muted-foreground">Stage distribution across portfolio</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pipelineStages}>
              <CartesianGrid stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="stage" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {pipelineStages.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <div className="text-sm font-semibold">AI Recommendations</div>
          </div>
          <div className="space-y-2.5">
            {recommendations.map((r) => (
              <div key={r.title} className="p-3 rounded-lg bg-muted/40 border border-border hover:border-primary/40 transition cursor-pointer group">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-medium leading-snug">{r.title}</div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">{r.type}</span>
                  <div className="flex-1 h-1 bg-muted rounded">
                    <div className="h-full rounded gradient-primary" style={{ width: `${r.confidence}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{r.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity */}
      <div className="glass rounded-xl p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-accent" />
          <div className="text-sm font-semibold">Live Activity</div>
          <span className="ml-2 text-[10px] flex items-center gap-1 text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success pulse-dot" /> Real-time
          </span>
        </div>
        <div className="divide-y divide-border">
          {activity.map((a) => (
            <div key={a.name + a.time} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 grid place-items-center text-[10px] font-semibold">
                {a.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate"><span className="font-medium">{a.name}</span> <span className="text-muted-foreground">{a.action}</span></div>
                <div className="text-[10px] text-muted-foreground">{a.time}</div>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <div className="text-[10px] text-muted-foreground">score</div>
                <span className={`text-xs font-semibold ${a.score > 75 ? "text-success" : a.score > 50 ? "text-warning" : "text-muted-foreground"}`}>{Math.round(a.score)}</span>
              </div>
              <Send className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-display font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}

export const tooltipStyle = {
  background: "rgba(20,25,40,0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  fontSize: 12,
  color: "#fff",
  backdropFilter: "blur(8px)",
};
