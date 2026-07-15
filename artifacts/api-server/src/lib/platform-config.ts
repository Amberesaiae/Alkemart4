/**
 * Env-driven platform constants for the Ghana-first marketplace.
 * Prefer these over scattering magic strings/numbers across routes.
 * Non-secret base defaults come from @workspace/platform-config.
 */

import {
  DEFAULT_CURRENCY as BASE_CURRENCY,
  DEFAULT_CURRENCY_SYMBOL as BASE_SYMBOL,
  DEFAULT_COUNTRY_CODE as BASE_COUNTRY,
  DEFAULT_LOCALE as BASE_LOCALE,
  DEFAULT_COMMISSION_BPS as BASE_COMMISSION_BPS,
} from "@workspace/platform-config";

function intEnv(name: string, fallback: number, min?: number, max?: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  if (min != null && n < min) return fallback;
  if (max != null && n > max) return fallback;
  return n;
}

function strEnv(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  return raw || fallback;
}

/** ISO 4217 — Paystack charge currency and display code. */
export const DEFAULT_CURRENCY = strEnv("DEFAULT_CURRENCY", BASE_CURRENCY).toUpperCase();

/** Display symbol for buyer-facing strings (emails, promo errors). */
export const DEFAULT_CURRENCY_SYMBOL = strEnv("DEFAULT_CURRENCY_SYMBOL", BASE_SYMBOL);

/** ISO 3166-1 alpha-2 default market. */
export const DEFAULT_COUNTRY_CODE = strEnv("DEFAULT_COUNTRY_CODE", BASE_COUNTRY).toUpperCase();

/** BCP 47 locale default. */
export const DEFAULT_LOCALE = strEnv("DEFAULT_LOCALE", BASE_LOCALE);

/** New-vendor commission in basis points (700 = 7%). */
export const DEFAULT_COMMISSION_BPS = intEnv("DEFAULT_COMMISSION_BPS", BASE_COMMISSION_BPS, 0, 10_000);

/** Session cookie lifetime (days). */
export const SESSION_TTL_DAYS = intEnv("SESSION_TTL_DAYS", 30, 1, 365);
export const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Transactional email From header.
 * Default is Resend's shared sandbox sender until a verified domain is set.
 */
export const EMAIL_FROM = strEnv("EMAIL_FROM", "Alkemart <onboarding@resend.dev>");

/**
 * Shipping / tax engines are not implemented yet.
 * Quote and checkout keep these at 0 so totals stay honest and explicit.
 */
export const QUOTE_SHIPPING_PESEWAS = intEnv("QUOTE_SHIPPING_PESEWAS", 0, 0);
export const QUOTE_TAX_PESEWAS = intEnv("QUOTE_TAX_PESEWAS", 0, 0);

/**
 * Payment TTL for pending MoMo orders. Abandonment worker sweeps orders
 * past this window and releases inventory holds.
 */
export const PAYMENT_PENDING_TTL_MINUTES = intEnv("PAYMENT_PENDING_TTL_MINUTES", 30, 10, 120);

/** Feature flags for staged rollout. */
export const PAYMENTS_ASYNC_MOMO = process.env.PAYMENTS_ASYNC_MOMO === "true";
export const OUTBOX_ENABLED = process.env.OUTBOX_ENABLED === "true";
export const SETTLEMENTS_ENABLED = process.env.SETTLEMENTS_ENABLED === "true";
