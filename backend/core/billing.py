"""Stripe billing helpers (all configuration comes from the environment).

The product is fully usable without Stripe: when ``STRIPE_SECRET_KEY`` is empty
the upgrade UI falls back to the manual request flow (bank transfer / JazzCash /
Easypaisa). Set the keys below to enable self-serve subscriptions.

Required env for online billing:
    STRIPE_SECRET_KEY       sk_test_... / sk_live_...
    STRIPE_WEBHOOK_SECRET   whsec_... (from the webhook endpoint's signing secret)
    STRIPE_PRICE_STARTER    price_... (recurring monthly price)
    STRIPE_PRICE_BUSINESS   price_...
    STRIPE_PRICE_ENTERPRISE price_...

Notes:
* Prices are created in the Stripe Dashboard; the PKR/USD amount and interval
  live there, not in this codebase.
* ``PUBLIC_BASE_URL`` is used for the checkout success/cancel redirects.
"""
import os

import stripe

# Plan name -> env var holding its Stripe recurring price id.
PLAN_PRICE_ENV = {
    "Starter": "STRIPE_PRICE_STARTER",
    "Business": "STRIPE_PRICE_BUSINESS",
    "Enterprise": "STRIPE_PRICE_ENTERPRISE",
}


def secret_key() -> str:
    return os.getenv("STRIPE_SECRET_KEY", "").strip()


def webhook_secret() -> str:
    return os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()


def configured() -> bool:
    """Online billing is available only when the secret key is present."""
    return bool(secret_key())


def price_id_for(plan) -> str:
    env_name = PLAN_PRICE_ENV.get(plan.name)
    return os.getenv(env_name, "").strip() if env_name else ""


def plan_name_for_price(price_id: str) -> str | None:
    if not price_id:
        return None
    for plan_name, env_name in PLAN_PRICE_ENV.items():
        if os.getenv(env_name, "").strip() == price_id:
            return plan_name
    return None


def purchasable_plan_ids(plans) -> list[int]:
    """Ids of plans this deployment can actually charge for."""
    return [p.id for p in plans if price_id_for(p)]


def client():
    stripe.api_key = secret_key()
    return stripe


def base_url() -> str:
    return (os.getenv("PUBLIC_BASE_URL", "") or "http://localhost:3000").rstrip("/")
