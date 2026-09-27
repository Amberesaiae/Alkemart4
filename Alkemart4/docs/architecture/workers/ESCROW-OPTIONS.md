# Escrow options — decide after the pilot

Written 2026-09-27. The pilot runs the simple version (option A). This page
keeps the other choices in one place, so the decision can be made with pilot
data instead of guesses.

## What "escrow" means for alkemart

The buyer's money waits somewhere safe until the buyer has the item, and only
then reaches the seller. Buyers see this as **alkemart Buyer Protection**.
Paystack does not sell a true escrow product; it offers ways to **delay
settlement**. Something on our side always says "delivered — release it".

## A. Pilot (built, on)

- Buyer pays online (MoMo or card) → the money sits in **alkemart's Paystack
  balance**, never alkemart's bank account.
- Release: the buyer's **handover code**, their **"I got it"**, or the end of
  the report window (24h same-day, 48h otherwise) with no problem reported.
- Admin presses **Pay everyone ready** once a day → Paystack transfers each
  released seller's money to their MoMo.
- A reported problem holds only that order; admin sees it in Returns &
  disputes.
- Pay on delivery: the seller collects the cash; nothing passes through us.
- Commission: 0% in the pilot (the seller gets the full price).

Admin effort: one press a day plus reported problems.

## B. Automatic payouts (built, off)

The same as A, but the transfer goes out the moment the money is released —
no daily press. Switch: `DEFAULT_PAYOUT_POLICY.autoPayout` in
`packages/domain/src/payout-state.ts` (and un-skip
`apps/api/src/routes/store/auto-payout.test.ts`).

Before switching on:
- Paystack → Settings → Preferences: turn off "Confirm transfers before
  sending" (OTP), or every transfer stalls.
- Keep enough balance: a same-day card or MoMo charge may not have settled
  into the balance yet; such a payout fails as low balance and the next
  release (or admin) sends it.
- Paystack charges a fee per transfer; per-order payouts mean more transfers
  than a daily batch. Check Paystack Ghana's transfer pricing.

## C. Paystack subaccounts with manual settlement (not built)

Each seller gets a Paystack subaccount. At checkout the payment is split:
alkemart's share (if any) to alkemart, the seller's share held by Paystack
under that seller until we ask for settlement.

- Upside: the seller's money is kept apart from alkemart's by Paystack, not
  just in our records.
- Open questions to ask Paystack Ghana before building:
  1. Can a manual-settlement subaccount be released **per order through the
     API**, or only on request / from the dashboard?
  2. Can a subaccount settle to a **MoMo wallet**, or only a bank account?
- If either answer is no, C adds admin work instead of removing it.

## D. No online payments (Jiji model)

Buyers pay the seller directly (cash or MoMo on delivery); alkemart never
touches order money. Trust comes from known shops, the handover code, reviews
and reports. Revenue from seller plans. Simplest, but no Buyer Protection.

## Regulation (not legal advice)

In A, B and C a licensed payment company (Paystack) holds the money; alkemart
decides when it is released. Whether that counts as holding customer funds
under Bank of Ghana rules (Payment Systems and Services Act, 2019, Act 987)
should be checked with Paystack and a Ghana adviser before scaling.

## What to measure in the pilot

- How long money waits between payment and release (code vs report window).
- How many orders get a problem report, and how many need admin.
- Share of orders paid online vs on delivery.
- Admin time spent on payouts per week.
- Sellers' feedback on payout speed.

If admin time on payouts matters → B. If sellers or regulators want the money
held apart from alkemart → C (after Paystack's answers). If buyers mostly pay
on delivery anyway → D may be enough.
