"""
RM Agent nodes for LangGraph.

LLM call budget per query:
  - planner_node  : 1 call  (intent-matched → 0 calls for common patterns)
  - executor_node : 0 calls (all steps handled by deterministic shortcuts)
  - reflector     : 0 calls
  - responder     : 0 calls (template-based)
  Total target    : 0-1 LLM calls per query
"""
from typing import Any
import json
import re
from datetime import datetime
from src.rm_agent.state import RMAgentState
from src.rm_agent.tool_registry import execute_tool, get_tool_schemas
from src.llm.base import LLMMessage

TOP_N = 3  # customers to score / draft for

# ── Provider helpers ──────────────────────────────────────────────────────────

def _make_provider(backend: str, ollama_model: str | None = None, nvidia_model: str | None = None):
    if backend == "gemini":
        from src.llm.gemini import GeminiProvider
        return GeminiProvider()
    elif backend == "ollama":
        from src.llm.ollama import OllamaProvider
        return OllamaProvider(model=ollama_model) if ollama_model else OllamaProvider()
    elif backend == "nvidia":
        from src.llm.nvidia import NvidiaProvider
        return NvidiaProvider(model=nvidia_model) if nvidia_model else NvidiaProvider()
    raise ValueError(f"Unknown LLM backend: {backend}")


def get_llm_from_state(state: RMAgentState, role: str = "default"):
    ollama_model = state.get("ollama_model")
    nvidia_model = state.get("nvidia_model")
    override = state.get(f"{role}_backend")
    if override:
        return _make_provider(
            override,
            ollama_model if override == "ollama" else None,
            nvidia_model if override == "nvidia" else None,
        )
    if state.get("llm_provider") is not None:
        return state["llm_provider"]
    backend = state.get("llm_backend", "ollama").lower()
    return _make_provider(
        backend,
        ollama_model if backend == "ollama" else None,
        nvidia_model if backend == "nvidia" else None,
    )


# ── Intent → plan (no LLM needed for common patterns) ────────────────────────

_QUERY_KW   = ("find", "show", "get", "list", "fetch", "which", "who", "search", "identify")
_SCORE_KW   = ("score", "rank", "value", "top", "best", "priorit", "evaluat", "high-value", "high value")
_DRAFT_KW   = ("draft", "message", "outreach", "email", "sms", "contact", "write", "re-engage", "reach")
_SEGMENT_KW = ("premium", "affluent", "mass", "dormant", "inactive")


_CONVERT_KW = ("convert", "re-engage", "re engage", "win back", "reactivate",
               "likely to", "outreach", "campaign", "reach out")


def _infer_plan(query: str) -> list[str] | None:
    """Return a deterministic plan for recognisable query patterns, or None."""
    q = query.lower()
    wants_query = any(k in q for k in _QUERY_KW) or any(k in q for k in _SEGMENT_KW)
    wants_score = any(k in q for k in _SCORE_KW)
    wants_draft = any(k in q for k in _DRAFT_KW) or any(k in q for k in _CONVERT_KW)

    if wants_query and wants_draft:
        return ["Query customers", "Score customers", "Draft messages"]
    if wants_query and wants_score:
        return ["Query customers", "Score customers"]
    if wants_query:
        return ["Query customers"]
    return None  # fall through to LLM


# ── Extract query params from the user text (no LLM) ─────────────────────────

_CITY_RE = re.compile(
    r"\b(mumbai|delhi|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|ahmedabad|jaipur)\b",
    re.I,
)
_MIN_BAL_RE = re.compile(r"balance[^\d]*(\d[\d,]*)", re.I)
_MIN_CREDIT_RE = re.compile(
    r"credit score[^\d\s]*\s*(?:above|over|greater than|>|atleast|at least)?\s*(\d{3})", re.I
)
_MIN_INCOME_RE = re.compile(r"income[^\d]*(\d[\d,]*)", re.I)
_MIN_REL_RE = re.compile(r"(\d+)\+?\s*year", re.I)


def _extract_query_args(query: str) -> dict:
    q = query.lower()
    args: dict = {}

    # Segment — explicit keywords
    if "premium" in q:
        args["segment"] = "premium"
    elif "affluent" in q:
        args["segment"] = "affluent"
    elif "mass" in q:
        args["segment"] = "mass"

    # Dormant / inactive — handled as a flag, not a segment
    if any(k in q for k in ("dormant", "inactive", "lapsed", "re-engage", "re engage", "win back")):
        args["dormant"] = True

    # High-value shorthand → premium segment + high balance floor
    if any(k in q for k in ("high-value", "high value", "high net worth", "hnw")):
        args.setdefault("segment", "premium")
        args.setdefault("min_balance", 200000)

    # City
    city_m = _CITY_RE.search(query)
    if city_m:
        args["city"] = city_m.group(1).title()

    # Min balance from text
    bal_m = _MIN_BAL_RE.search(query)
    if bal_m:
        args["min_balance"] = int(bal_m.group(1).replace(",", ""))

    # Credit score threshold
    credit_m = _MIN_CREDIT_RE.search(query)
    if credit_m:
        args["min_credit_score"] = int(credit_m.group(1))

    # Income threshold
    income_m = _MIN_INCOME_RE.search(query)
    if income_m:
        args["min_income"] = int(income_m.group(1).replace(",", ""))

    # Product ownership filters  — "no credit card" / "without a loan" etc.
    if any(k in q for k in ("no credit card", "without credit card", "don't have credit card",
                             "do not have credit card", "no card")):
        args["has_credit_card"] = False
    elif any(k in q for k in ("has credit card", "with credit card", "have credit card")):
        args["has_credit_card"] = True

    if any(k in q for k in ("no personal loan", "without personal loan", "no loan")):
        args["has_personal_loan"] = False
    elif any(k in q for k in ("has personal loan", "with personal loan")):
        args["has_personal_loan"] = True

    if any(k in q for k in ("no home loan", "without home loan", "no mortgage")):
        args["has_home_loan"] = False

    if any(k in q for k in ("no fd", "no fixed deposit")):
        args["has_fd"] = False

    # Loyalty — "5+ year customers" etc.
    rel_m = _MIN_REL_RE.search(q)
    if rel_m and "year" in q:
        args["min_relationship_years"] = int(rel_m.group(1))

    return args


# ── Best product to recommend ─────────────────────────────────────────────────

_PRODUCT_KW_MAP = [
    # Most-specific first — "personal loan" must beat "loan"
    (("personal loan",),                  "PL001"),
    (("home loan", "housing loan", "housing", "mortgage"), "HL001"),
    (("credit card", "card"),             "CC001"),
    (("fixed deposit", "fd", "deposit"),  "FD001"),
    (("loan",),                           "PL001"),  # generic "loan" → personal loan
]
_DEFAULT_PRODUCT = "CC001"


def _pick_product(query: str) -> str:
    q = query.lower()
    for kws, pid in _PRODUCT_KW_MAP:
        if any(k in q for k in kws):
            return pid
    return _DEFAULT_PRODUCT


# ── Tool runner (shared by all shortcuts) ─────────────────────────────────────

def _run_tool(state: RMAgentState, tool_name: str, arguments: dict) -> Any:
    try:
        result = execute_tool(tool_name, arguments)
    except Exception as e:
        result = {"error": str(e)}

    state["tool_call_log"].append({
        "tool_name": tool_name,
        "arguments": arguments,
        "result": result,
        "timestamp": datetime.utcnow().isoformat(),
    })

    if tool_name == "query_customers":
        if not isinstance(result, dict) or "error" not in result:
            state["customer_set"] = result
            state["customer_count"] = len(result)

    elif tool_name == "score_customer_value":
        cid = arguments.get("customer_id")
        if cid and isinstance(result, dict) and "error" not in result:
            state["scores_cache"][cid] = result

    elif tool_name == "predict_conversion_probability":
        cid = arguments.get("customer_id")
        if cid and isinstance(result, dict) and "error" not in result:
            # Store conv prob alongside scores for later use in drafting
            if cid not in state["scores_cache"]:
                state["scores_cache"][cid] = {}
            state["scores_cache"][cid]["conversion_probability"] = result.get("probability")
            state["scores_cache"][cid]["top_signals"] = result.get("top_signals", [])

    elif tool_name == "draft_outreach_message":
        if isinstance(result, dict) and "error" not in result:
            state["drafts"].append({
                "customer_id": arguments.get("customer_id", ""),
                "customer_name": arguments.get("customer_name", ""),
                "product_id": arguments.get("product_id", ""),
                "message": result.get("primary_message", ""),
                "short_variant": result.get("short_variant", ""),
                "personalization_note": result.get("personalization_note", ""),
                "offer_expiry": result.get("offer_expiry", ""),
                "framework": result.get("framework", arguments.get("framework", "AIDA")),
                "tone": result.get("tone", arguments.get("tone", "warm")),
                "conversion_probability": result.get("conversion_probability"),
            })

    return result


# ── Nodes ─────────────────────────────────────────────────────────────────────

def planner_node(state: RMAgentState) -> RMAgentState:
    """
    Derive a plan from the user query.
    Common patterns resolved with zero LLM calls via intent matching.
    Only truly ambiguous queries go to the LLM.
    """
    query = state["user_query"]

    # Fast path — no LLM needed
    plan = _infer_plan(query)
    if plan:
        state["task_plan"] = plan
        state["current_plan_step"] = 0
        state["step"] = 1
        state["conversation_history"].append({
            "role": "assistant",
            "content": f"Plan ({len(plan)} steps): " + " → ".join(plan),
        })
        return state

    # Slow path — use LLM for ambiguous queries (1 call)
    llm = get_llm_from_state(state, role="planner")
    prompt = (
        f"Banking CRM task: {query}\n\n"
        "Return ONLY a JSON object with a 'plan' array of step strings.\n"
        'Use steps from: "Query customers", "Score customers", "Draft messages".\n'
        'Example: {"plan": ["Query customers", "Score customers", "Draft messages"]}'
    )
    try:
        response = llm.complete(
            [LLMMessage("system", "You are a banking CRM planner. Output ONLY valid JSON."),
             LLMMessage("user", prompt)],
            temperature=0.1, max_tokens=200,
        )
        start, end = response.find("{"), response.rfind("}") + 1
        plan = json.loads(response[start:end]).get("plan", [])
        if not plan:
            raise ValueError("empty plan")
    except Exception as e:
        # Hard fallback — never leave plan empty
        plan = ["Query customers", "Score customers", "Draft messages"]

    state["task_plan"] = plan
    state["current_plan_step"] = 0
    state["step"] = 1
    state["conversation_history"].append({
        "role": "assistant",
        "content": "Plan: " + " → ".join(plan),
    })
    return state


def executor_node(state: RMAgentState) -> RMAgentState:
    """
    Execute the current plan step with ZERO LLM calls.
    Every recognised step type is handled by a deterministic shortcut.
    """
    if state["current_plan_step"] >= len(state["task_plan"]):
        state["step"] = 2
        return state

    step = state["task_plan"][state["current_plan_step"]].lower()
    query = state["user_query"]
    product_id = _pick_product(query)

    # ── Query customers ───────────────────────────────────────────────────────
    query_kw = ("query", "find", "fetch", "search", "list", "identify", "show", "get")
    if any(k in step for k in query_kw):
        args = _extract_query_args(query)
        _run_tool(state, "query_customers", args)
        state["current_plan_step"] += 1
        return state

    # ── Score customers ───────────────────────────────────────────────────────
    score_kw = ("score", "value", "rank", "priorit", "evaluat", "assess")
    if any(k in step for k in score_kw) and state["customer_set"]:
        to_score = [
            c for c in state["customer_set"]
            if c["customer_id"] not in state["scores_cache"]
        ][:TOP_N]
        for c in to_score:
            _run_tool(state, "score_customer_value", {"customer_id": c["customer_id"]})
        state["current_plan_step"] += 1
        return state

    # ── Draft messages ────────────────────────────────────────────────────────
    # Full pipeline per customer:
    #   1. predict_conversion_probability  → signals + tone selection
    #   2. get_transaction_summary         → spend context for personalization
    #   3. draft_outreach_message          → real loan amounts / EMIs
    draft_kw = ("draft", "message", "outreach", "email", "sms", "contact", "write", "send")
    if any(k in step for k in draft_kw) and state["customer_set"]:
        if state["scores_cache"]:
            target_ids = sorted(
                state["scores_cache"],
                key=lambda cid: state["scores_cache"][cid].get("score", 0),
                reverse=True,
            )[:TOP_N]
        else:
            target_ids = [c["customer_id"] for c in state["customer_set"][:TOP_N]]

        id_map = {c["customer_id"]: c for c in state["customer_set"]}
        drafted = {d["customer_id"] for d in state["drafts"]}

        for cid in target_ids:
            if cid in drafted:
                continue
            c = id_map.get(cid, {})

            # Step 1 — conversion probability (drives tone + personalization note)
            conv_result = _run_tool(
                state, "predict_conversion_probability",
                {"customer_id": cid, "product_id": product_id},
            )
            conv_prob = (
                conv_result.get("probability")
                if isinstance(conv_result, dict) and "error" not in conv_result
                else None
            )

            # Step 2 — transaction context (drives spend category for CC msgs, etc.)
            txn_result = _run_tool(
                state, "get_transaction_summary",
                {"customer_id": cid, "window_days": 90},
            )
            txn_context = (
                txn_result
                if isinstance(txn_result, dict) and "error" not in txn_result
                else None
            )

            # Step 3 — draft personalized message with all signals
            _run_tool(state, "draft_outreach_message", {
                "customer_id": cid,
                "customer_name": c.get("name", cid),
                "product_id": product_id,
                "framework": "AIDA",
                "tone": "warm",  # message_tool will auto-adjust from conv_prob
                "conversion_probability": conv_prob,
                "transaction_context": txn_context,
            })

        state["current_plan_step"] += 1
        return state

    # ── Unknown step — skip it rather than burning an LLM call ───────────────
    state["tool_call_log"].append({
        "tool_name": "skipped",
        "arguments": {"step": step},
        "result": {"info": "unrecognised step — skipped to save quota"},
        "timestamp": datetime.utcnow().isoformat(),
    })
    state["current_plan_step"] += 1
    return state


def reflector_node(state: RMAgentState) -> RMAgentState:
    if state["error"] and state["current_plan_step"] == 0:
        state["step"] = 99
        return state
    state["step"] = 1 if state["current_plan_step"] < len(state["task_plan"]) else 3
    return state


def responder_node(state: RMAgentState) -> RMAgentState:
    """
    Build the final answer. Uses LLM for natural language quality (1 call).
    Falls back to a structured template if LLM fails or quota is exhausted.
    """
    customers = state["customer_set"]
    scores    = state["scores_cache"]
    drafts    = state["drafts"]
    query     = state["user_query"]

    # Build a compact data summary to feed the LLM — no raw lists, just facts
    top_scored = sorted(scores.values(), key=lambda x: x.get("score", 0), reverse=True)[:TOP_N]
    score_summary = "\n".join(
        f"  - {s.get('customer_id')} ({s.get('tier','?')}): score {s.get('score',0):.1f}"
        for s in top_scored
    ) or "  None scored yet."

    draft_summary_parts = []
    for d in drafts[:TOP_N]:
        conv = d.get("conversion_probability")
        conv_str = f" ({conv*100:.0f}% conv. prob.)" if conv is not None else ""
        pnote = d.get("personalization_note", "")
        draft_summary_parts.append(
            f"  - {d['customer_name']}{conv_str}: \"{d['message'][:80]}…\"\n"
            f"    Signals: {pnote}"
        )
    draft_summary = "\n".join(draft_summary_parts) or "  None drafted."

    data_block = (
        f"Customers found: {len(customers)}\n"
        f"Top scored:\n{score_summary}\n"
        f"Drafts prepared:\n{draft_summary}"
    )

    prompt = (
        f"You are a banking CRM assistant. The relationship manager asked:\n"
        f"\"{query}\"\n\n"
        f"Here is what the agent completed:\n{data_block}\n\n"
        f"Write a concise, friendly 2–4 sentence summary for the RM. "
        f"Mention key numbers, highlight the top customer(s), and confirm what's ready to send. "
        f"Do not use bullet lists — write in natural prose."
    )

    try:
        llm = get_llm_from_state(state, role="default")
        answer = llm.complete(
            [LLMMessage("system", "You are a helpful banking CRM assistant. Be concise and specific."),
             LLMMessage("user", prompt)],
            temperature=0.5,
            max_tokens=300,
        )
    except Exception:
        # Quota exhausted or network error — fall back to template, never crash
        parts = []
        if customers:
            parts.append(f"Found {len(customers)} customers matching your criteria.")
        if top_scored:
            best = top_scored[0]
            parts.append(
                f"Top customer: {best.get('customer_id')} "
                f"(score {best.get('score',0):.1f}, {best.get('tier','?')})."
            )
        if drafts:
            parts.append(f"{len(drafts)} outreach message(s) are ready to send.")
        answer = " ".join(parts) or "Task completed — no matching customers found."

    state["final_answer"] = answer
    state["conversation_history"].append({"role": "assistant", "content": answer})
    return state
