import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "./DashboardPage";
import { pipeline as pipelineApi, type PipelineData, type PipelineReply } from "@/lib/api";
import {
  MessageSquare, CheckCheck, Sparkles, RefreshCw,
  TrendingUp, Users, Target, ArrowRight, Phone,
  Clock, Inbox, AlertTriangle, ChevronRight,
} from "lucide-react";

// ── Intent badge colours ──────────────────────────────────────────────────────

const INTENT_STYLE: Record<string, string> = {
  YES:              "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  NO:               "bg-red-500/20 text-red-400 border-red-500/30",
  PRICE_OBJECTION:  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  HAS_PRODUCT:      "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DOCUMENTS:        "bg-purple-500/20 text-purple-400 border-purple-500/30",
  TIMELINE:         "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  WANTS_CALLBACK:   "bg-orange-500/20 text-orange-400 border-orange-500/30",
  THINKING:         "bg-slate-500/20 text-slate-400 border-slate-500/30",
  GENERAL:          "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  INTERESTED:       "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const STAGE_ORDER = [
  "NEW", "CONTACTED", "ENGAGED", "CONSIDERING",
  "CALLBACK_REQUESTED", "INTERESTED", "OBJECTION",
  "DECLINED", "CONVERTED", "WON", "LOST",
];

function intentLabel(state: string) {
  const map: Record<string, string> = {
    YES: "✅ Yes / Interested",
    NO: "❌ Not Interested",
    PRICE_OBJECTION: "💰 Price Objection",
    HAS_PRODUCT: "📋 Has Product",
    DOCUMENTS: "📄 Docs Query",
    TIMELINE: "⏱️ Timeline Query",
    WANTS_CALLBACK: "📞 Callback Request",
    THINKING: "🤔 Considering",
    GENERAL: "💬 General",
    INTERESTED: "✅ Interested",
  };
  return map[state] ?? state;
}

// ── Funnel bar ────────────────────────────────────────────────────────────────

function FunnelBar({ funnel }: { funnel: { stage: string; count: number }[] }) {
  const ordered = STAGE_ORDER
    .map(s => funnel.find(f => f.stage === s))
    .filter(Boolean) as { stage: string; count: number }[];

  const max = Math.max(...ordered.map(f => f.count), 1);
  const highlight: Record<string, string> = {
    INTERESTED: "bg-emerald-500",
    CONVERTED: "bg-emerald-600",
    WON: "bg-emerald-700",
    OBJECTION: "bg-amber-500",
    DECLINED: "bg-red-500",
    LOST: "bg-red-600",
  };

  return (
    <div className="space-y-1.5">
      {ordered.map(({ stage, count }) => (
        <div key={stage} className="flex items-center gap-2">
          <div className="w-28 text-[10px] font-mono text-muted-foreground text-right truncate">
            {stage}
          </div>
          <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all duration-700 ${highlight[stage] ?? "bg-primary/60"}`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <div className="w-6 text-[11px] font-semibold text-right">{count}</div>
        </div>
      ))}
    </div>
  );
}

// ── Conversation thread card ──────────────────────────────────────────────────

function ConvCard({ reply, active, onClick }: {
  reply: PipelineReply;
  active: boolean;
  onClick: () => void;
}) {
  const badge = INTENT_STYLE[reply.pipeline_state] ?? INTENT_STYLE.GENERAL;
  const initials = reply.customer_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const time = new Date(reply.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-lg transition
        ${active ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/40 border border-transparent"}`}
    >
      <div className="w-9 h-9 rounded-full gradient-primary grid place-items-center text-xs font-bold text-primary-foreground flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="text-sm font-medium truncate">{reply.customer_name}</span>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">{time}</span>
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{reply.response}</div>
        <div className={`inline-flex mt-1 items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${badge}`}>
          {intentLabel(reply.pipeline_state)}
        </div>
      </div>
    </button>
  );
}

// ── WhatsApp bubble ───────────────────────────────────────────────────────────

function WaBubble({ text, from, time }: { text: string; from: "customer" | "agent"; time: string }) {
  const isAgent = from === "agent";
  const html = text
    .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`flex items-end gap-2 ${isAgent ? "justify-start" : "justify-end"}`}
    >
      {isAgent && (
        <div className="w-7 h-7 rounded-full gradient-primary grid place-items-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      )}
      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm ${
        isAgent
          ? "bg-[#1e2535] border border-white/8 rounded-bl-sm"
          : "bg-[#025144] border border-white/8 rounded-br-sm"
      }`}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-muted-foreground">
          {time}
          {!isAgent && <CheckCheck className="w-3 h-3 text-blue-400" />}
        </div>
      </div>
    </motion.div>
  );
}

// ── Stage tracker ─────────────────────────────────────────────────────────────

const VISIBLE_STAGES = ["CONTACTED", "ENGAGED", "INTERESTED", "CALLBACK_REQUESTED", "CONVERTED"];

function StageTracker({ stage }: { stage: string }) {
  const normalised = stage === "WON" ? "CONVERTED" : stage === "LOST" ? "DECLINED" : stage;
  const idx = VISIBLE_STAGES.indexOf(normalised);

  return (
    <div className="space-y-1.5">
      {VISIBLE_STAGES.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        return (
          <div key={s} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition ${
            current ? "bg-primary/15 text-primary border border-primary/30" :
            done ? "text-emerald-400" : "text-muted-foreground"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              current ? "bg-primary animate-pulse" :
              done ? "bg-emerald-400" : "bg-muted-foreground/30"
            }`} />
            <span className="font-mono font-medium">{s}</span>
            {current && (
              <AnimatePresence>
                <motion.span
                  initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }}
                  className="ml-auto text-[10px] text-muted-foreground"
                >
                  active
                </motion.span>
              </AnimatePresence>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ConversationsPage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PipelineReply | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const POLL_MS = 8000; // refresh every 8 s

  const load = async () => {
    try {
      const d = await pipelineApi.get();
      setData(d);
      if (!selected && d.recent_replies.length > 0) {
        setSelected(d.recent_replies[0]);
      }
    } catch (e) {
      console.error("pipeline fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [selected]);

  const replies = data?.recent_replies ?? [];

  // ── KPI tiles ──────────────────────────────────────────────────────────────
  const kpis = [
    { label: "Contacted",  val: data?.total_contacted ?? 0, icon: <Users className="w-4 h-4" />,    color: "text-blue-400" },
    { label: "Replied",    val: data?.total_replied   ?? 0, icon: <MessageSquare className="w-4 h-4" />, color: "text-primary" },
    { label: "Converted",  val: data?.total_converted ?? 0, icon: <Target className="w-4 h-4" />,   color: "text-emerald-400" },
    {
      label: "Conv Rate",
      val: data && data.total_replied > 0
        ? `${Math.round((data.total_converted / data.total_replied) * 100)}%`
        : "—",
      icon: <TrendingUp className="w-4 h-4" />,
      color: "text-amber-400",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading pipeline data…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 h-[calc(100vh-7rem)] flex flex-col">
      <PageHeader
        title="WhatsApp Inbox & Pipeline"
        subtitle="Live AI sales conversations — replies tracked, intents classified, funnel updated automatically."
        actions={
          <button
            onClick={load}
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {kpis.map(({ label, val, icon, color }) => (
          <div key={label} className="glass rounded-xl p-3 shadow-card flex items-center gap-3">
            <div className={`${color} opacity-80`}>{icon}</div>
            <div>
              <div className="text-lg font-bold leading-none">{val}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">

        {/* ── Left: inbox list ───────────────────────────────────────────── */}
        <div className="lg:col-span-3 glass rounded-xl flex flex-col shadow-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border text-xs font-semibold flex items-center gap-2">
            <Inbox className="w-3.5 h-3.5 text-primary" />
            Replies <span className="ml-auto bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[10px]">{replies.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {replies.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No replies yet. Send a campaign and wait for customers to respond.
              </div>
            ) : (
              replies.map((r, i) => (
                <ConvCard
                  key={`${r.customer_id}-${i}`}
                  reply={r}
                  active={selected?.customer_id === r.customer_id && selected?.date === r.date}
                  onClick={() => setSelected(r)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Centre: chat thread ────────────────────────────────────────── */}
        <div className="lg:col-span-6 glass rounded-xl flex flex-col shadow-card overflow-hidden">
          {selected ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/40 flex-shrink-0">
                <div className="w-9 h-9 rounded-full gradient-primary grid place-items-center text-xs font-bold text-primary-foreground">
                  {selected.customer_name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {selected.customer_name}
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{selected.product ?? "Unknown product"} · WhatsApp</div>
                </div>
                <div className={`text-[10px] px-2 py-0.5 rounded border ${INTENT_STYLE[selected.pipeline_state] ?? INTENT_STYLE.GENERAL}`}>
                  {intentLabel(selected.pipeline_state)}
                </div>
              </div>

              {/* Chat */}
              <div
                ref={chatRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(ellipse_at_top,oklch(0.18_0.03_260),oklch(0.14_0.02_260))]"
              >
                {/* Outreach message placeholder */}
                <div className="flex justify-center mb-2">
                  <span className="text-[10px] text-muted-foreground bg-muted/40 border border-border px-3 py-1 rounded-full">
                    Campaign message sent · AI agent active
                  </span>
                </div>

                {/* Customer reply */}
                <WaBubble
                  text={selected.response}
                  from="customer"
                  time={new Date(selected.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                />

                {/* AI reply */}
                {selected.ai_reply && (
                  <WaBubble
                    text={selected.ai_reply}
                    from="agent"
                    time={new Date(selected.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  />
                )}

                {!selected.ai_reply && (
                  <div className="flex justify-center">
                    <span className="text-[10px] text-muted-foreground bg-muted/40 border border-border px-3 py-1 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Awaiting AI reply…
                    </span>
                  </div>
                )}
              </div>

              {/* Composer — read only for now, shows AI handled */}
              <div className="border-t border-border p-3 flex items-center gap-2 bg-card/40 flex-shrink-0">
                <div className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground italic">
                  AI Sales Agent (Rahul) handles replies automatically…
                </div>
                <div className="w-9 h-9 grid place-items-center rounded-lg gradient-primary">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <MessageSquare className="w-12 h-12 opacity-20" />
              <div className="text-sm">Select a conversation to view</div>
            </div>
          )}
        </div>

        {/* ── Right: pipeline + actions ──────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4 overflow-y-auto">
          {/* Stage tracker */}
          <div className="glass rounded-xl p-4 shadow-card">
            <div className="text-xs font-semibold mb-3 flex items-center gap-2">
              <ArrowRight className="w-3.5 h-3.5 text-primary" />
              Pipeline Stage
            </div>
            {selected ? (
              <StageTracker stage={selected.pipeline_state} />
            ) : (
              <div className="text-xs text-muted-foreground">Select a conversation</div>
            )}
          </div>

          {/* Funnel overview */}
          {data && (
            <div className="glass rounded-xl p-4 shadow-card">
              <div className="text-xs font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                Full Funnel
              </div>
              <FunnelBar funnel={data.funnel} />
            </div>
          )}

          {/* Quick actions for selected conv */}
          {selected && (
            <div className="glass rounded-xl p-4 shadow-card space-y-2">
              <div className="text-xs font-semibold">Quick Actions</div>
              {selected.pipeline_state === "INTERESTED" || selected.pipeline_state === "CALLBACK_REQUESTED" ? (
                <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2">
                  🔥 Hot lead — schedule callback!
                </div>
              ) : selected.pipeline_state === "OBJECTION" ? (
                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                  ⚠️ Objection detected — AI countered. Monitor for follow-up.
                </div>
              ) : null}
              <button className="w-full text-xs py-2 rounded-lg gradient-primary text-primary-foreground font-medium flex items-center justify-center gap-1.5">
                <Phone className="w-3 h-3" /> Schedule Callback
              </button>
              <button className="w-full text-xs py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 flex items-center justify-center gap-1.5">
                <ChevronRight className="w-3 h-3" /> View Customer Profile
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
