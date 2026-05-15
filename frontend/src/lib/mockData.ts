// Synthetic banking data generator — deterministic seed
type Rand = () => number;
function mulberry32(seed: number): Rand {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => Math.floor(rand() * (max - min) + min);

const FIRST_NAMES = ["Aarav","Vivaan","Aditya","Vihaan","Arjun","Sai","Reyansh","Krishna","Ishaan","Rohan","Ananya","Diya","Aadhya","Saanvi","Pari","Anika","Navya","Myra","Sara","Aarohi","Rahul","Priya","Kavya","Neha","Rohit","Sneha","Vikram","Meera","Karan","Tara","Aryan","Riya","Dev","Isha","Yash","Tanvi","Kabir","Anaya","Zara","Vivek"];
const LAST_NAMES = ["Sharma","Verma","Iyer","Patel","Reddy","Singh","Kapoor","Mehta","Joshi","Gupta","Nair","Rao","Khan","Bose","Das","Shah","Malhotra","Banerjee","Chopra","Bhat"];
const CITIES = ["Mumbai","Bengaluru","Delhi","Hyderabad","Chennai","Pune","Kolkata","Ahmedabad","Gurgaon","Noida"];
const SEGMENTS = ["Affluent","Mass Affluent","HNI","Salaried","Self-Employed","Young Professional"] as const;
const STAGES = ["NEW","CONTACTED","ENGAGED","OBJECTION","QUALIFIED","CLOSING","WON","LOST"] as const;
const PRODUCTS = ["Personal Loan","Home Loan","Credit Card Upgrade","Mutual Funds","Fixed Deposit","Wealth Mgmt","Auto Loan","Insurance"];
const OCCUPATIONS = ["Software Engineer","Doctor","Business Owner","Marketing Manager","Architect","Consultant","Banker","Teacher","Designer","Lawyer"];

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  age: number;
  occupation: string;
  segment: typeof SEGMENTS[number];
  stage: typeof STAGES[number];
  monthlyIncome: number;
  totalRelationshipValue: number;
  creditScore: number;
  productsHeld: string[];
  conversionScore: number; // 0-100
  valueScore: number; // 0-100
  churnRisk: number; // 0-100
  recommendedProduct: string;
  lastInteraction: string;
  nextBestAction: string;
  tags: string[];
  joinedDays: number;
};

export type Transaction = {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  category: string;
  type: "credit" | "debit";
  merchant: string;
};

const TX_CATEGORIES = ["Salary","Groceries","Travel","Dining","Investment","EMI","Utilities","Shopping","Healthcare","Entertainment"];
const MERCHANTS = ["HDFC Salary","Big Bazaar","MakeMyTrip","Zomato","Zerodha","ICICI EMI","Tata Power","Amazon","Apollo","Netflix"];

function relativeDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function makeCustomer(i: number): Customer {
  const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  const segment = pick([...SEGMENTS]);
  const income = segment === "HNI" ? between(500000, 2500000)
    : segment === "Affluent" ? between(200000, 600000)
    : between(40000, 200000);
  const trv = income * between(6, 36);
  const conversionScore = between(15, 98);
  const valueScore = Math.min(100, Math.round((trv / 5000000) * 50 + between(10, 50)));
  const productsCount = between(1, 5);
  const productsHeld = Array.from(new Set(Array.from({ length: productsCount }, () => pick(PRODUCTS))));
  const recommended = pick(PRODUCTS.filter((p) => !productsHeld.includes(p))) || "Personal Loan";
  const stage = pick([...STAGES]);
  const tags: string[] = [];
  if (valueScore > 75) tags.push("High Value");
  if (conversionScore > 80) tags.push("Hot Lead");
  if (segment === "HNI") tags.push("Priority");
  if (rand() > 0.85) tags.push("Do Not Disturb");
  return {
    id: `CUST-${(10000 + i).toString()}`,
    name,
    email: `${name.toLowerCase().replace(/\s/g, ".")}@mail.com`,
    phone: `+91 9${between(100000000, 999999999)}`,
    city: pick(CITIES),
    age: between(24, 62),
    occupation: pick(OCCUPATIONS),
    segment,
    stage,
    monthlyIncome: income,
    totalRelationshipValue: trv,
    creditScore: between(620, 820),
    productsHeld,
    conversionScore,
    valueScore,
    churnRisk: between(5, 70),
    recommendedProduct: recommended,
    lastInteraction: relativeDate(between(0, 60)),
    nextBestAction: pick([
      "Send personalized loan offer",
      "Schedule advisory call",
      "Cross-sell wealth product",
      "Engage on credit upgrade",
      "Retention outreach",
    ]),
    tags,
    joinedDays: between(60, 1800),
  };
}

export const customers: Customer[] = Array.from({ length: 520 }, (_, i) => makeCustomer(i));

export function txForCustomer(custId: string, n = 24): Transaction[] {
  const out: Transaction[] = [];
  for (let i = 0; i < n; i++) {
    const isCredit = rand() > 0.7;
    out.push({
      id: `TX-${custId}-${i}`,
      customerId: custId,
      date: relativeDate(i * 14 + between(0, 6)),
      amount: between(500, isCredit ? 200000 : 80000),
      category: pick(TX_CATEGORIES),
      type: isCredit ? "credit" : "debit",
      merchant: pick(MERCHANTS),
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// Aggregate KPIs
export const kpis = {
  totalCustomers: customers.length,
  highValue: customers.filter((c) => c.valueScore > 70).length,
  hotLeads: customers.filter((c) => c.conversionScore > 75).length,
  pipelineValue: customers.reduce((s, c) => s + c.totalRelationshipValue, 0),
  activeCampaigns: 14,
  responseRate: 38.7,
  conversionRate: 12.4,
  outreachSent: 8421,
};

export const segmentBreakdown = SEGMENTS.map((s) => ({
  name: s,
  value: customers.filter((c) => c.segment === s).length,
}));

export const pipelineStages = STAGES.map((s) => ({
  stage: s,
  count: customers.filter((c) => c.stage === s).length,
}));

export const conversionTrend = Array.from({ length: 12 }, (_, i) => ({
  month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  sent: between(400, 1200),
  responded: between(100, 500),
  converted: between(20, 180),
}));

export const responseRateData = Array.from({ length: 14 }, (_, i) => ({
  day: `D${i + 1}`,
  rate: between(20, 55),
  benchmark: 32,
}));

export function formatINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)} K`;
  return `₹${n}`;
}
