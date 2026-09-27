# Paystack — practices, use cases, and who sees what

Checked against Paystack's docs (webhooks, single transfers, verify
payments) on 2026-09-26. Sources:
<https://paystack.com/docs/payments/webhooks/>,
<https://paystack.com/docs/transfers/single-transfers/>,
<https://paystack.com/docs/payments/verify-payments/>.

## Rules we follow

| Paystack guidance | How alkemart does it |
|---|---|
| Verify the `x-paystack-signature` HMAC-SHA512 of the raw body | `verifyPaystackWebhookSignature`, constant-time compare, before parsing |
| Acknowledge with 200; retries run for 72h (live) | Anything a retry can't fix is acknowledged and raised as an alert |
| Dedupe events; make effects idempotent | CAS state changes, unique `order_groups.payment_intent_id`, unique `payout_lines.order_id`, ledger idempotency keys; KV is only a fast path |
| Webhooks are sent only for **successful** charges | Expiry verifies with Paystack before expiring (`reconcileStaleIntent`) |
| Check `data.status`, not the HTTP status | Client reads `data.status`; `PaystackError.definite` separates "Paystack said no" (4xx) from "no answer" |
| Verify amount (and currency) server-side | `assertPaystackAmountMatches` + `assertPaystackCurrencyMatches` |
| One transfer reference per payout; retry with the **same** reference | Reference is reserved with the payout before any call; Retry reuses it |
| Final transfer state comes by webhook (`transfer.success/failed/reversed`) or `GET /transfer/verify/:reference` | Both settle the payout; admin "Check status" calls verify |
| Disable transfer OTP for automated payouts | Ops setting; the admin screen flags `otp` responses |
| Optional IP allowlist (52.31.139.75, 52.49.173.169, 52.214.14.220) | Not enforced (signature is required); can be added at the edge |

## Use cases

| # | What happens | What the system does | Admin sees | Seller sees | Buyer sees |
|---|---|---|---|---|---|
| 1 | Buyer pays by MoMo/card, webhook arrives | Verify status + amount + currency → create order | Order; Paystack log "confirmed" | New order to pack | Order confirmed |
| 2 | Webhook is late or lost | Expiry job asks Paystack → success → creates the order | Paystack log | Order | Order confirmed (late) |
| 3 | Buyer abandons checkout | Paystack says abandoned/failed → expire, release stock | — | — | Checkout expired |
| 4 | Charge still in progress at expiry time | Wait and re-check (up to 24h) | — | — | Still pending |
| 5 | Paystack unreachable | Wait; never expire blindly | — | — | Still pending |
| 6 | Buyer paid **after** we closed the checkout | No order (stock was released); webhook acknowledged | **Alert** + "Refund buyer" | — | Refund after admin acts |
| 7 | Success webhook with wrong amount/currency | Confirm refuses; Paystack retries; logged | Paystack log "retrying" | — | — |
| 8 | Successful charge we have no checkout for | Logged | **Alert** | — | — |
| 9 | Pay on delivery | Seller keeps cash; never in payouts | Orders | "Cash collected" + commission owed | — |
| 10 | Admin pays a seller | Reserve exact orders + reference → send | Timeline: created, sent | "On its way" | — |
| 11 | Paystack confirms the transfer | Webhook/check → paid + ledger row | Paid | "Arrived on your MoMo", with reference | — |
| 12 | Paystack refuses (bad recipient, low balance) | Payout failed with reason; orders back in next payout | Failed + reason | "Didn't go through", reason, orders not lost | — |
| 13 | Transfer call times out | Payout stays unconfirmed; Check status / Retry (same reference) | "Not confirmed" + guidance | "Being prepared" | — |
| 14 | Transfer reversed by the network | Reversed + ledger adjustment; orders back in next payout | Reversed + reason | "Returned by the network" | — |
| 15 | Transfer webhook amount ≠ payout net | Not settled | **Alert** | Still "On its way" | — |
| 16 | Admin presses Pay twice | Second press returns the in-flight payout | "Already on its way" | — | — |
| 17 | Order under dispute | Order hold with written reason; excluded from payouts | Hold + who placed it | Banner: which order, the reason | — |
| 18 | Account under review | Account hold blocks payouts | Pay disabled with reason | Banner: reason | — |
| 19 | OTP still on in Paystack | Payout sent but waiting | Toast + event "wants an OTP" | "On its way" | — |
| 20 | Buyer opens a dispute / chargeback | Logged | **Alert** | — | — |
| 21 | Refund processed / failed | Logged (failed = alert) | Paystack log | — | Refund |
| 22 | Seller changes MoMo number | Paystack creates a recipient first; saved only if valid | Masked number on payable list | Masked number; "Changes are recorded" | — |

## Still open (decisions or ops)

- **Delivery fee on online payouts:** payouts are `subtotal − commission`;
  the buyer's delivery fee isn't passed to the seller. Confirm intent.
- **COD commission recovery:** owed commission is shown, not collected.
  Options: net it off the next online payout, or collect by MoMo request.
- **Refunds for real orders** need a returns flow; today refunds are only
  for paid-after-close checkouts (no order).
- **Dispute evidence** (upload photos/receipts to Paystack) isn't built.
- **MoMo name check:** show the account holder's name before saving a
  payout number (Paystack resolve), so sellers catch typos.
- **Ops:** apply migrations 0036–0040; set the webhook URL; disable transfer
  OTP; roll the live secret key that was shared in chat.

## Real Paystack test-mode run (2026-09-26)

Sandbox (in-memory data) wired to Paystack's **real test API** with the
owner's `sk_test_` key (`SANDBOX_REAL_PAYSTACK=1`; any other key is refused).
No live key, no real money, no real database.

| Step | What Paystack answered | Our system |
|---|---|---|
| Seller sets MoMo payout number (MTN) | Created a transfer recipient | Saved; MTN bank-code mapping confirmed valid |
| Payout of GH₵3,441 | Balance GH₵1,690.95 | Blocked before sending: "Top up Paystack first" |
| Buyer MoMo checkout, GH₵400 item, email `…@sandbox.test` | "Invalid Email Address Passed" | Stock released, payment marked failed; buyer message now plain-language |
| Buyer MoMo checkout, valid email | Charge `success` | Order kept pending until verified |
| Status poll → verify | `success`, amount + currency match | Order created |
| Seller ships → delivers | — | Order payable |
| Payout GH₵372 (after 7% commission) | Transfer created (`TRF_…`), status `otp` | Payout stays "Sending"; admin told to turn off transfer OTP |
| Check status | `otp` | No false "paid"/"failed"; timeline records it |

| Signed `charge.success` webhook (Paystack format, signed with the test key) for a fresh real charge | — | Tampered body → 401; unsigned → 401; valid → verified with Paystack's real API → order created; repeat delivery → acknowledged, still one order |
| Second payout after restart | Transfer status `otp` again | Confirms transfer OTP is still on in the test account |

**Still to prove (needs the owner):** a transfer reaching `success` — turn off
"Confirm transfers before sending" in the Paystack test dashboard; and
Paystack's own webhook delivery over the internet — a tunnel to the API plus
the test webhook URL set in Paystack. Signature checking and verification are
already proven above.
