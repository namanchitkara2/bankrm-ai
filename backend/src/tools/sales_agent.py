"""
AI Sales Agent — responds to incoming WhatsApp messages as a real RM would.

Given:
  - Customer profile (income, credit score, tenure, segment)
  - The product offer that was sent (loan amount, rate, EMI)
  - The customer's last outreach message
  - The customer's reply

Returns a short, natural WhatsApp reply that:
  - Handles YES → confirms next step, asks for preferred callback time
  - Handles objections ("too expensive", "already have a loan") → counter gracefully
  - Answers questions ("what documents?", "how long?") → accurate answers
  - Handles NO → accepts gracefully, leaves door open
  - Stays in character as a friendly, professional bank RM
  - Keeps replies SHORT (2-4 sentences max — this is WhatsApp, not email)
"""
from typing import Optional, Dict, Any
from src.database import SessionLocal, Customer, Interaction, IdentityGraph, Product
from src.llm.base import LLMMessage
from src.config import settings


# ── Objection / intent classifier (no LLM needed) ────────────────────────────

def _classify_intent(text: str) -> str:
    t = text.lower().strip()
    if any(k in t for k in ["yes", "interested", "ok", "okay", "sure", "haan", "ha ", "proceed", "apply", "want"]):
        return "YES"
    if any(k in t for k in ["no", "nahi", "not interested", "dont", "don't", "nope", "cancel"]):
        return "NO"
    if any(k in t for k in ["expensive", "high rate", "emi", "interest", "rate", "cost", "affordab"]):
        return "PRICE_OBJECTION"
    if any(k in t for k in ["already have", "existing loan", "current loan", "other bank"]):
        return "HAS_PRODUCT"
    if any(k in t for k in ["document", "docs", "paper", "kyc", "what do i need", "requirement"]):
        return "DOCUMENTS"
    if any(k in t for k in ["how long", "time", "days", "process", "fast", "quick", "disburs"]):
        return "TIMELINE"
    if any(k in t for k in ["call", "callback", "speak", "talk", "phone", "meet"]):
        return "WANTS_CALLBACK"
    if any(k in t for k in ["think", "consider", "later", "sometime", "maybe", "will let you know"]):
        return "THINKING"
    return "GENERAL"


# ── Intent → template shortcut (saves LLM call for common patterns) ───────────

def _template_reply(intent: str, customer: Customer, product: Product,
                    loan_amount: str, rate: float, emi: str) -> Optional[str]:
    name = customer.name.split()[0]
    p    = product.name

    templates = {
        "YES": (
            f"That's great, {name}! 🎉 Your {p} for {loan_amount} at {rate}% p.a. is pre-approved. "
            f"What time works best for a quick call — morning or afternoon? "
            f"I'll have everything ready and we can complete the process in under 10 minutes."
        ),
        "NO": (
            f"Completely understood, {name}! No pressure at all. "
            f"The offer stays open till month-end if you change your mind. "
            f"Have a great day! 😊"
        ),
        "DOCUMENTS": (
            f"For the {p}, you'll need: PAN card, last 3 months' salary slips, "
            f"6 months bank statement, and Aadhaar. "
            f"Since you're an existing customer, {name}, your KYC is already verified — "
            f"so the process is much faster for you! Want me to send the upload link?"
        ),
        "TIMELINE": (
            f"Great news, {name} — for existing customers like you, disbursal is typically within *24 hours* "
            f"of document upload. No branch visit needed, everything is digital. "
            f"Want to go ahead?"
        ),
        "WANTS_CALLBACK": (
            f"Of course, {name}! What time works best for you — "
            f"morning (10am–12pm) or afternoon (2pm–5pm)? "
            f"I'll personally call you to walk through everything."
        ),
        "THINKING": (
            f"Absolutely, {name}, take your time! Just so you know — the offer at {rate}% p.a. "
            f"is valid till end of month. Feel free to ping me anytime with questions. 😊"
        ),
        "PRICE_OBJECTION": (
            f"I hear you, {name}! The EMI of {emi} might look high upfront, but consider this — "
            f"that's for the full {loan_amount} amount. You can also choose a smaller amount "
            f"and the EMI drops proportionally. Would a 7-year tenure work better for you? That brings the monthly down significantly."
        ),
        "HAS_PRODUCT": (
            f"Totally makes sense, {name}! This is actually a *fresh* {p} — separate from any existing one. "
            f"Many customers use it for a specific goal like home renovation or education. "
            f"Would that be useful for you right now, or is there another product I can help with?"
        ),
    }
    return templates.get(intent)


# ── Main entry point ──────────────────────────────────────────────────────────

def generate_sales_reply(
    customer: Customer,
    product: Product,
    outreach_message: str,
    customer_reply: str,
    conversation_history: list,
    loan_amount_str: str,
    rate: float,
    emi_str: str,
) -> str:
    """
    Generate an AI sales agent reply to a customer's WhatsApp message.
    Uses template shortcuts for common intents; falls back to LLM for
    nuanced / multi-turn conversations.
    """
    intent = _classify_intent(customer_reply)
    name   = customer.name.split()[0]

    # Fast path — template reply for common intents
    template = _template_reply(intent, customer, product, loan_amount_str, rate, emi_str)
    if template and len(conversation_history) <= 2:
        return template

    # LLM path — for objections, complex questions, multi-turn
    personas = {
        "premium": ("Arjun Sharma", "Senior Relationship Manager", "consultative, high-formality"),
        "affluent": ("Priya Mehta", "Relationship Manager", "professional, solutions-focused"),
        "mass": ("Rahul", "Bank Relationship Manager", "friendly, simple language"),
    }
    rm_name, rm_title, rm_style = personas.get(customer.segment or "mass", personas["mass"])

    # Build prior objections and interactions context
    prior_objections = [
        turn["content"] for turn in conversation_history
        if turn.get("role") == "user" and _classify_intent(turn["content"]) in ("PRICE_OBJECTION", "HAS_PRODUCT", "NO")
    ]
    callbacks_promised = any(
        _classify_intent(turn["content"]) == "WANTS_CALLBACK"
        for turn in conversation_history
        if turn.get("role") == "user"
    )

    memory_context = ""
    if prior_objections:
        memory_context += f"\nPRIOR OBJECTIONS RAISED: {'; '.join(prior_objections[-2:])}"
    if callbacks_promised:
        memory_context += "\nIMPORTANT: Customer previously requested a callback — reference this."
    if len(conversation_history) > 2:
        memory_context += f"\nThis is turn {len(conversation_history)//2 + 1} of an ongoing conversation."

    system_prompt = f"""You are {rm_name}, {rm_title} at BankRM. Communication style: {rm_style}.
You are having a WhatsApp conversation with {customer.name}, one of the bank's {customer.segment} segment customers.

CUSTOMER PROFILE:
- Segment: {customer.segment.title()} | Tenure: {int(customer.relationship_years or 0)} years
- Annual Income: ₹{(customer.annual_income or 0)/100000:.1f}L | Monthly Balance: ₹{(customer.monthly_avg_balance or 0)/100000:.1f}L
- Credit Score: {customer.credit_score or 'N/A'} | City: {customer.city or 'N/A'}

PRODUCT OFFERED: {product.name}
- Loan Amount: {loan_amount_str}
- Interest Rate: {rate}% p.a. (fixed)
- EMI: {emi_str}/month for 5 years
- No collateral required | Disbursal in 24 hours
{memory_context}

RULES:
- Keep replies SHORT — max 3-4 sentences. This is WhatsApp, not email.
- Be warm, human, and conversational. Use the customer's first name ({name}).
- Handle objections gracefully — never be pushy.
- For YES: confirm next step (callback time), build excitement.
- For price objections: reframe around EMI affordability and benefits.
- For "already have a loan": ask about top-up or explain this is a fresh facility.
- Answer document/timeline questions accurately using the profile above.
- End every reply with a clear, single question or call-to-action.
- You can use 1-2 relevant emojis but don't overdo it.
- Speak in English. If customer writes in Hindi, reply in simple English.
- NEVER make up numbers or promises you can't keep."""

    # Build conversation context
    history_text = ""
    for turn in conversation_history[-6:]:  # last 3 exchanges
        role = "You" if turn["role"] == "assistant" else name
        history_text += f"{role}: {turn['content']}\n"

    user_prompt = (
        f"Conversation so far:\n{history_text}\n"
        f"{name} just said: \"{customer_reply}\"\n\n"
        f"Reply as {rm_name} ({rm_title}). Keep it short and WhatsApp-natural."
    )

    try:
        from src.llm.gemini import GeminiProvider
        llm = GeminiProvider()
    except Exception:
        try:
            from src.llm.ollama import OllamaProvider
            llm = OllamaProvider()
        except Exception:
            return template or f"Thanks for your message, {name}! Let me check and get back to you shortly. 😊"

    try:
        reply = llm.complete(
            [LLMMessage("system", system_prompt), LLMMessage("user", user_prompt)],
            temperature=0.7,
            max_tokens=200,
        )
        return reply.strip()
    except Exception:
        return template or f"Thanks {name}! I'll look into this and get back to you right away. 😊"
