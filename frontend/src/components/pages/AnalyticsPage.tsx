import { PageHeader, tooltipStyle } from "./DashboardPage";
import { conversionTrend, responseRateData, segmentBreakdown } from "@/lib/mockData";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const COLORS = ["#5b8bff", "#34d399", "#a78bfa", "#fbbf24", "#f472b6", "#22d3ee"];

export function AnalyticsPage() {
  const segPerf = segmentBreakdown.map((s, i) => ({
    segment: s.name, conversion: 30 + (i * 9) % 50, engagement: 40 + (i * 13) % 50,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        subtitle="Deep performance analytics across campaigns, customers, and AI workflows."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Conversion Funnel" subtitle="Sent → Replied → Converted">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={conversionTrend}>
              <CartesianGrid stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="sent" stroke="#5b8bff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="responded" stroke="#a78bfa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="converted" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Outreach Response Rate" subtitle="14-day rolling vs benchmark">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={responseRateData}>
              <defs>
                <linearGradient id="rg" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="rate" stroke="#34d399" fill="url(#rg)" strokeWidth={2} />
              <Line type="monotone" dataKey="benchmark" stroke="#fbbf24" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Segment Performance" subtitle="Conversion vs engagement">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={segPerf}>
              <CartesianGrid stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="segment" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
              <Bar dataKey="conversion" fill="#5b8bff" radius={[4,4,0,0]} />
              <Bar dataKey="engagement" fill="#34d399" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="AI Campaign Effectiveness" subtitle="Multi-dimensional scorecard">
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={[
              { metric: "Personalization", v: 88 },
              { metric: "Timing", v: 76 },
              { metric: "Framework Fit", v: 91 },
              { metric: "Compliance", v: 99 },
              { metric: "Conv. Lift", v: 72 },
              { metric: "Cost / Lead", v: 65 },
            ]}>
              <PolarGrid stroke="#ffffff15" />
              <PolarAngleAxis dataKey="metric" stroke="#94a3b8" fontSize={10} />
              <PolarRadiusAxis stroke="#ffffff10" tick={false} axisLine={false} />
              <Radar dataKey="v" stroke="#5b8bff" fill="#5b8bff" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-5 shadow-card">
      <div className="mb-3">
        <div className="text-sm font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}
