# Seller identity verification — approach for later

Status: **documented, not built.** The pilot runs with known shops that the
team onboards by hand. Build this before opening seller sign-up to the public.

Written 2026-09-26.

## Why and when

Trust is the product. Buyers in Ghana doubt that what they see is what they'll
get, and scams usually start with an unknown seller. Verification is a trust
choice: as far as we know, a marketplace that takes payment through Paystack
is not itself required to KYC sellers (Paystack KYCs us). Confirm with a lawyer
before relying on that.

## Layers (cheapest first)

| Layer | How | Cost | Who |
|---|---|---|---|
| 1. Phone OTP | SMS code at sign-up (Africa's Talking is already wired) | Pesewas per SMS | Every seller and buyer |
| 2. MoMo name match | Compare the name registered on the payout wallet with the shop owner's name. Ghana's SIM re-registration tied every wallet to a Ghana Card, so this reuses the telco's check | Free | Every seller, at payout setup |
| 3. Ghana Card number format | `GHA-XXXXXXXXX-X` shape + check digit | Free | Every seller |
| 4. NIA-backed check | Ghana Card + selfie with liveness through a licensed provider | Paid per check | Once per seller, before the first payout or for risky categories (phones, laptops) |
| 5. Business registration | ORC number (optional) | Free to collect | Sellers who want the badge |

Open question for layer 2: whether Paystack returns the registered name for
Ghana MoMo ("resolve account"). Test it before depending on it.

## Providers (layer 4)

All are pay-per-check with a free sandbox; none offers a free production tier.

- Smile ID — used by Jiji for its "Verified ID" badge. Sandbox free; pricing
  on request (third-party estimates: ~$0.10–0.30 document, ~$0.30–1.00 with
  selfie).
- Youverify, Dojah, QoreID, MetaMap — all list Ghana Card support.
- NIA directly — the most official route; needs institutional onboarding.

Pick on: NIA-backed database check (not photo reading alone), a signed data
processing agreement, price per check, and liveness quality.

Jiji only shows its badge while the seller pays for a Boost package. We make
verification free for sellers; we charge for visibility, not trust.

## Data protection

- Register with Ghana's Data Protection Commission before collecting ID data.
- Store only the result, provider reference, date, and a masked card number.
  Never store card photos or selfies ourselves; the provider holds them under
  its agreement.
- Admin sees verified / not verified and the matched name, not the documents.

## Build sketch (when it's time)

- `seller_verifications` already exists (badges). Add kinds `phone`, `momo_name`,
  `national_id`, `business_reg` with `provider`, `reference`, `verified_at`,
  `masked_number`.
- Payouts: `PayoutBlockedError` when `national_id` is required and missing
  (the hold mechanism already exists).
- Vendor: a step in `/setup` ("Verify your identity") and a badge on the shop.
- Provider behind an interface so it can be swapped; keys in Worker secrets.
