// Simulated agentic execution trace for the demo
export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output: unknown;
  durationMs: number;
  status: "pending" | "running" | "success" | "error";
};

export type AgentStep = {
  id: string;
  type: "plan" | "tool" | "reflect" | "respond";
  label: string;
  detail: string;
  toolCall?: ToolCall;
  startedAt: number;
  endedAt?: number;
};

export const PLAYBOOK_STEPS: Omit<AgentStep, "startedAt" | "endedAt">[] = [
  {
    id: "p1",
    type: "plan",
    label: "Planner · Decompose query",
    detail: "Goal: identify high-value loan-likely customers in Mumbai → score → recommend → draft outreach.",
  },
  {
    id: "t1",
    type: "tool",
    label: "query_customers",
    detail: "filter: city=Mumbai, segment∈{Affluent,HNI}, no_active_loan=true",
    toolCall: {
      id: "tc1", name: "query_customers", durationMs: 420, status: "success",
      input: { city: "Mumbai", segment: ["Affluent", "HNI"], hasActiveLoan: false, limit: 50 },
      output: { matched: 42, sample: ["CUST-10024", "CUST-10183", "CUST-10299"] },
    },
  },
  {
    id: "t2",
    type: "tool",
    label: "score_customer_value",
    detail: "Compute relationship value across deposits, holdings, tenure, and product breadth.",
    toolCall: {
      id: "tc2", name: "score_customer_value", durationMs: 280, status: "success",
      input: { customerIds: ["..42 ids"], features: ["balance", "products", "tenure"] },
      output: { mean: 71.2, top: [{ id: "CUST-10024", score: 94 }, { id: "CUST-10183", score: 91 }] },
    },
  },
  {
    id: "t3",
    type: "tool",
    label: "predict_conversion",
    detail: "Logistic regression on engagement, income, recent inquiries.",
    toolCall: {
      id: "tc3", name: "predict_conversion", durationMs: 360, status: "success",
      input: { product: "Personal Loan", model: "lr-v3" },
      output: { likely: 18, mean_p: 0.67, calibrated: true },
    },
  },
  {
    id: "t4",
    type: "tool",
    label: "recommend_products",
    detail: "Match income, life-stage and existing holdings to product catalog.",
    toolCall: {
      id: "tc4", name: "recommend_products", durationMs: 190, status: "success",
      input: { strategy: "complementary", topK: 1 },
      output: { recommended: "Personal Loan @ 10.49% · ₹12L pre-approved" },
    },
  },
  {
    id: "t5",
    type: "tool",
    label: "check_suppressions",
    detail: "Compliance: DND list, opt-out, recent contact frequency caps.",
    toolCall: {
      id: "tc5", name: "check_suppressions", durationMs: 110, status: "success",
      input: { channel: "whatsapp", windowDays: 14 },
      output: { suppressed: 4, eligible: 14 },
    },
  },
  {
    id: "r1",
    type: "reflect",
    label: "Reflection · Quality check",
    detail: "Confidence > 0.7. Personalization tokens present. No PII leak. Approved for synthesis.",
  },
  {
    id: "t6",
    type: "tool",
    label: "draft_outreach_message",
    detail: "Framework: AIDA. Tone: warm-professional. Length: 3 sentences. Personalization: name, city, recent FD maturity.",
    toolCall: {
      id: "tc6", name: "draft_outreach_message", durationMs: 540, status: "success",
      input: { framework: "AIDA", channel: "whatsapp", variants: 2 },
      output: { variants: 2, avg_chars: 312 },
    },
  },
  {
    id: "resp",
    type: "respond",
    label: "Synthesizer · Final response",
    detail: "Returning shortlist of 14 customers + 2 personalized message variants per customer.",
  },
];

export const SAMPLE_OUTREACH = {
  customer: "Aarav Sharma · Mumbai · HNI",
  variantA: `Hi Aarav, this is Rohan from your relationship desk. I noticed your FD matures next week and wanted to share a pre-approved Personal Loan of ₹12L at 10.49% — fully digital, with funds in 2 hours. Would 3 mins on call work tomorrow?`,
  variantB: `Hi Aarav 👋 — quick heads-up: based on your relationship with us, you're pre-approved for ₹12L Personal Loan at 10.49% (no docs). Many Mumbai clients use it to consolidate higher-cost EMIs. Reply YES and I'll share the offer letter.`,
  framework: "AIDA · Cialdini (Authority + Scarcity)",
  estConversion: 0.71,
};
