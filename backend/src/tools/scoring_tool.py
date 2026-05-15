"""
Scoring tools for customer value and conversion probability.

predict_conversion_probability uses 8 behavioral signals derived from
real transaction history, product ownership, and CRM data to produce
a calibrated likelihood score.
"""
from typing import Dict, Any, Optional
from src.database import SessionLocal, Customer, Transaction, Product
from datetime import datetime, timedelta


def score_customer_value(customer_id: str) -> Dict[str, Any]:
    """
    Score customer lifetime value using a multi-factor weighted heuristic.

    Formula (normalized 0–100):
        income    × 0.20
        balance   × 0.20
        tenure    × 0.15
        products  × 0.15
        credit    × 0.20
        kyc       × 0.10

    Returns:
        Score, tier (High / Medium / Standard), and factor breakdown.
    """
    session = SessionLocal()
    try:
        customer = session.query(Customer).filter_by(customer_id=customer_id).first()
        if not customer:
            return {"error": f"Customer {customer_id} not found"}

        income_norm  = min((customer.annual_income or 0) / 5_000_000, 1.0)
        balance_norm = min((customer.monthly_avg_balance or 0) / 1_000_000, 1.0)
        tenure_norm  = min((customer.relationship_years or 0) / 20, 1.0)

        products_held = sum([
            bool(customer.has_credit_card),
            bool(customer.has_personal_loan),
            bool(customer.has_home_loan),
            bool(customer.has_fd),
        ])
        products_norm = products_held / 4

        credit_score_norm = ((customer.credit_score or 550) - 550) / 350  # range 550–900

        score = (
            0.20 * income_norm
            + 0.20 * balance_norm
            + 0.15 * tenure_norm
            + 0.15 * products_norm
            + 0.20 * credit_score_norm
            + 0.10 * (1 if customer.kyc_status == "verified" else 0)
        )
        score_100 = min(score * 100, 100)

        if score_100 >= 75:
            tier = "High Value"
        elif score_100 >= 50:
            tier = "Medium Value"
        else:
            tier = "Standard"

        return {
            "customer_id": customer_id,
            "score": round(score_100, 2),
            "tier": tier,
            "factors": {
                "income_norm":       round(income_norm, 3),
                "balance_norm":      round(balance_norm, 3),
                "tenure_norm":       round(tenure_norm, 3),
                "products_norm":     round(products_norm, 3),
                "credit_score_norm": round(credit_score_norm, 3),
                "kyc_verified":      customer.kyc_status == "verified",
            },
            "weights": {
                "income": 0.20, "balance": 0.20, "tenure": 0.15,
                "products": 0.15, "credit_score": 0.20, "kyc": 0.10,
            },
        }
    finally:
        session.close()


# ── Product-ownership map (product_id → Customer boolean attribute name) ───────

_PRODUCT_OWNERSHIP = {
    "PL001": "has_personal_loan",
    "CC001": "has_credit_card",
    "HL001": "has_home_loan",
    "FD001": "has_fd",
}


def predict_conversion_probability(
    customer_id: str,
    product_id: str,
) -> Dict[str, Any]:
    """
    Predict conversion probability using 8 behavioral signals.

    Signals (applied as multiplicative modifiers on a segment base rate):
      1. Already owns the product  → × 0.05  (near-zero — won't buy again)
      2. Product gap (no ownership)→ × 1.25  (opportunity upsell)
      3. High balance (> ₹3L)      → × 1.25
      4. Very high balance (> ₹6L) → × 1.10  (stacked on top)
      5. Excellent credit (≥ 750)  → × 1.20
      6. Low credit (< 650)        → × 0.70
      7. Highly loyal (≥ 10 yrs)   → × 1.20
      8. Loyal customer (≥ 5 yrs)  → × 1.10
      9. Active user (≥ 15 txns/mo)→ × 1.15
     10. Regular salary inflow      → × 1.12
     11. Recent spending spike (↑>20%)→ × 1.08

    Base rates by segment: mass=15%, affluent=25%, premium=35%
    Output capped at 95%.

    Returns:
        probability, percentile, confidence, base_rate, modifiers list,
        plus the 3 strongest positive signals as human-readable strings
        (for use in message personalization).
    """
    session = SessionLocal()
    try:
        customer = session.query(Customer).filter_by(customer_id=customer_id).first()
        if not customer:
            return {"error": f"Customer {customer_id} not found"}

        base_rates = {"mass": 0.15, "affluent": 0.25, "premium": 0.35}
        base_prob = base_rates.get(customer.segment or "mass", 0.20)
        prob = base_prob
        modifiers = []

        # ── Signal 1: Already owns this product ───────────────────────────────
        owns_attr = _PRODUCT_OWNERSHIP.get(product_id)
        already_owns = bool(getattr(customer, owns_attr, False)) if owns_attr else False
        if already_owns:
            prob *= 0.05
            modifiers.append({"factor": "Already owns product", "multiplier": 0.05,
                               "direction": "negative"})
            # Short-circuit — no point stacking other signals
            return {
                "customer_id": customer_id,
                "product_id": product_id,
                "probability": round(prob, 3),
                "percentile": round(prob * 100, 1),
                "base_rate": round(base_prob, 3),
                "modifiers": modifiers,
                "confidence": "high",
                "top_signals": ["Customer already holds this product — low upsell opportunity"],
            }

        # ── Signal 2: Product gap (upsell opportunity) ────────────────────────
        if owns_attr and not already_owns:
            prob *= 1.25
            modifiers.append({"factor": "Product gap — upsell opportunity", "multiplier": 1.25,
                               "direction": "positive"})

        # ── Signal 3 & 4: Balance ─────────────────────────────────────────────
        balance = customer.monthly_avg_balance or 0
        if balance >= 600_000:
            prob *= 1.25 * 1.10
            modifiers.append({"factor": "Very high balance (≥ ₹6L)", "multiplier": 1.375,
                               "direction": "positive"})
        elif balance >= 300_000:
            prob *= 1.25
            modifiers.append({"factor": "High balance (≥ ₹3L)", "multiplier": 1.25,
                               "direction": "positive"})

        # ── Signal 5 & 6: Credit score ────────────────────────────────────────
        cs = customer.credit_score or 0
        if cs >= 750:
            prob *= 1.20
            modifiers.append({"factor": f"Excellent credit score ({cs})", "multiplier": 1.20,
                               "direction": "positive"})
        elif cs > 0 and cs < 650:
            prob *= 0.70
            modifiers.append({"factor": f"Below-average credit score ({cs})", "multiplier": 0.70,
                               "direction": "negative"})

        # ── Signal 7 & 8: Tenure / loyalty ───────────────────────────────────
        tenure = customer.relationship_years or 0
        if tenure >= 10:
            prob *= 1.20
            modifiers.append({"factor": f"Highly loyal customer ({int(tenure)} yrs)", "multiplier": 1.20,
                               "direction": "positive"})
        elif tenure >= 5:
            prob *= 1.10
            modifiers.append({"factor": f"Loyal customer ({int(tenure)} yrs)", "multiplier": 1.10,
                               "direction": "positive"})

        # ── Signal 9: Transaction activity ───────────────────────────────────
        txn_30d_count = (
            session.query(Transaction)
            .filter(
                Transaction.customer_id == customer_id,
                Transaction.date >= datetime.utcnow() - timedelta(days=30),
            )
            .count()
        )
        if txn_30d_count >= 15:
            prob *= 1.15
            modifiers.append({"factor": f"Active digital user ({txn_30d_count} txns/30d)",
                               "multiplier": 1.15, "direction": "positive"})

        # ── Signal 10: Regular salary inflow ──────────────────────────────────
        salary_txn_count = (
            session.query(Transaction)
            .filter(
                Transaction.customer_id == customer_id,
                Transaction.category.ilike("%salary%"),
                Transaction.date >= datetime.utcnow() - timedelta(days=90),
            )
            .count()
        )
        if salary_txn_count >= 2:  # at least 2 monthly credits in 90 days
            prob *= 1.12
            modifiers.append({"factor": "Regular salary inflow detected", "multiplier": 1.12,
                               "direction": "positive"})

        # ── Signal 11: Recent spending velocity spike ─────────────────────────
        recent_30 = (
            session.query(Transaction)
            .filter(
                Transaction.customer_id == customer_id,
                Transaction.date >= datetime.utcnow() - timedelta(days=30),
            )
            .all()
        )
        prior_30 = (
            session.query(Transaction)
            .filter(
                Transaction.customer_id == customer_id,
                Transaction.date >= datetime.utcnow() - timedelta(days=60),
                Transaction.date < datetime.utcnow() - timedelta(days=30),
            )
            .all()
        )
        recent_spend = sum(t.amount for t in recent_30)
        prior_spend  = sum(t.amount for t in prior_30)
        if prior_spend > 0 and recent_spend > prior_spend * 1.20:
            prob *= 1.08
            modifiers.append({"factor": "Spending velocity up >20% vs prior month",
                               "multiplier": 1.08, "direction": "positive"})

        final_prob = min(prob, 0.95)

        # Build human-readable top-signal list (positive only, top 3 by multiplier)
        pos_signals = sorted(
            [m for m in modifiers if m["direction"] == "positive"],
            key=lambda m: m["multiplier"],
            reverse=True,
        )[:3]
        top_signals = [s["factor"] for s in pos_signals]

        confidence = (
            "high" if final_prob >= 0.55
            else "medium" if final_prob >= 0.30
            else "low"
        )

        return {
            "customer_id":   customer_id,
            "product_id":    product_id,
            "probability":   round(final_prob, 3),
            "percentile":    round(final_prob * 100, 1),
            "base_rate":     round(base_prob, 3),
            "modifiers":     modifiers,
            "confidence":    confidence,
            "top_signals":   top_signals,
        }
    finally:
        session.close()
