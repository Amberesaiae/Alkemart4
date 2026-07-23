---
name: Testing real Paystack momo charges in sandbox
description: How to exercise chargeMobileMoney/refund flows against Paystack's real test-mode API without a mock.
---

Paystack's sandbox rejects mobile money charges from arbitrary phone numbers with
"Declined. Please use the test mobile money number since you are doing a test
transaction." Only Paystack's documented test numbers succeed, e.g. `0551234987`
for MTN Ghana. See https://paystack.com/docs/payments/test-payments/#mobile-money
for the current list (also has EFT/card/bank test numbers).

**Why:** the api-server's `PAYSTACK_SECRET_KEY` is a live sandbox key — there is no
local mock for `chargeMobileMoney`, so integration tests hit the real Paystack API.

**How to apply:** when writing a script/test that calls `/api/checkout` with
`paymentMethod: "momo"`, always use a Paystack test number for `momoPhone`, or the
charge will fail with a misleading "Declined" error unrelated to your code under test.

**Concurrency tests:** firing two *simultaneous* charges from the same test number
sometimes gets one or both declined by Paystack's sandbox (duplicate/fraud guard or
a "Rate limit exceeded!" 400 if you re-run the suite back-to-back many times).
Automated race tests should retry the whole attempt (with a fresh DB fixture, e.g. a
new promo code) when a decline shows up instead of the expected app-level failure,
and callers re-running such a suite manually should leave a short gap between runs.
