# Kid Glossary — Alkemart's big computer words, explained like you're 7

> Imagine you and your friends run a **giant toy shop** called Alkemart.
> Customers are kids in Ghana. Your toys (the data) live in a big warehouse
> far away in **Ireland**. Everything below is just different ways of moving
> toys, guarding the shop, and paying the bills.

## The shops and roads (networks & latency)

- **Latency** — How long you wait after asking for something. You shout "I want
  the red car!" — latency is the seconds until it's in your hands. Smaller =
  faster = happier.
- **Round trip** — Sending a letter to Ireland asking "do you have the red car?"
  and waiting for the reply letter. Every question costs one round trip. Ask 16
  questions one-by-one = 16 round trips = sloooow.
- **Edge / Edge location (PoP)** — Instead of one giant shop far away, you open
  **tiny kiosks** in every neighborhood (Accra, Lagos). A PoP ("Point of
  Presence" — a fancy name for "we are HERE too") is one of those kiosks. The
  closer the kiosk, the shorter the wait.
- **Last-mile** — The road from the kiosk to the kid's house. In Ghana this road
  is often bumpy (phone networks), so even if everything else is instant, this
  last bumpy road can still take a while. It's usually the slowest part and
  nobody can fix it except the road builders.
- **Egress** — Toys LEAVING the warehouse. Some landlords charge you every time
  a toy leaves the building. Cloudflare doesn't. Railway and Amazon do. When
  your shop sends lots of toy photos to customers, egress fees can eat all your
  pocket money.
- **DNS** — The phone book of the internet. You know the shop's *name*
  ("api-dot-something"), DNS tells you its *house number* (like
  `140.82.121.4`). If the phone book is ripped, nothing can find anything.
- **IPv4 / IPv6** — Two kinds of house numbers. Old kind (IPv4, like
  `140.82.121.4`) and new kind (IPv6, long and twisty). If your street can only
  read old numbers but the phone book hands you new ones, you're lost.
- **TLS / HTTPS** — A secret code language. When the shop and the customer talk
  in TLS, eavesdroppers only hear gibberish. The little 🔒 in the browser means
  "we're speaking secret code."

## Hot and cold (speed tricks)

- **Cold start** — The ice-cream truck is parked, engine off, driver asleep.
  The first customer waits while everything wakes up. Cloudflare's truck is
  *never* asleep (0ms). A container's truck sometimes naps (seconds).
- **Warm** — The truck is already running and the ice cream is already scooped.
  The second customer gets served instantly. (Our catalog went 15 seconds →
  0.017 seconds: the first trip warmed everything up.)
- **Cache / Edge cache** — Writing the answer on a sticky note on the kiosk
  wall. The next kid asks "how much is the red car?" — you just read the sticky
  note instead of mailing Ireland. Sticky notes save thousands of letters.
- **TTL** — The sticky note says "throw away after 60 seconds." TTL ("time to
  live") = how long the note is trusted before you must ask Ireland again.
  Short TTL = fresher answers, more letters. Long TTL = faster, but maybe
  yesterday's price.
- **KV** — A giant wall of tiny labeled drawers at every kiosk (Key-Value
  store). You put a note in drawer `"catalog"` and every kiosk in the world can
  peek into its own copy in ~1 millisecond.

## The warehouse (database words)

- **Postgres** — The warehouse itself. A super-organized building where every
  toy has a labeled shelf. The most popular warehouse brand in the world.
- **Supabase** — A company that rents you a Postgres warehouse and also gives
  you free helpers (logins, file shelves). Our warehouse lives in Ireland
  (eu-west-1).
- **Pooler / PgBouncer** — The warehouse has ONE door and gets crushed if 1,000
  kids push through at once. The pooler is a patient doorman who lets kids in a
  few at a time through a side gate. Send 75 kids at once and the doorman
  panics (those were our ECONNRESET errors).
- **Hyperdrive** — Cloudflare's *super-doorman*. It stands next to the Ireland
  warehouse holding doors open in advance, so when a kid arrives from Lagos,
  they walk straight in. Plus it photocopies popular answers (query caching).
- **Full-table scan** — Counting toys by walking past EVERY shelf and looking
  at each toy. Fine for 10 toys; terrible for 10,000.
- **Index** — The alphabetical list at the back of a storybook. Instead of
  reading the whole book to find "dragon," you check the list: "dragon → page
  42." Migration 0028 added three such lists (by product, by status).
- **B-tree** — The shape of that back-of-book list: a family tree of "is it
  before M or after M?" questions. You find any toy in ~4 questions even among
  millions.
- **Targeted query** — Walking in and saying "I want THESE 12 toys" (one short
  list).
- **Sequential queries** — Asking "do you have toy 1?" … waiting … "toy 2?" …
  waiting … 16 times. The old snapshot path did this; slice loaders ask once.
- **UUID** — A toy's unguessable secret name, like `b9e0be86-d2b2-...`. So long
  that no two toys in the universe ever share one. Ugly, but links never break.
- **Slug** — The toy's pretty nickname: `leather-sandals`. Our links look like
  `leather-sandals-b9e0be86...` — pretty nickname first (for humans), secret
  name last (for the computer, always correct even if the nickname changes).

## The two landlords (Railway vs Cloudflare)

- **Container** — A toy shop packed inside a shipping box: shop + shelves + cash
  register, all in one box you can drop anywhere. Railway rents you boxes.
  Cozy but heavy to start (cold starts) and you pay rent 24/7.
- **V8 isolate** — Cloudflare's trick: instead of a whole shipping box per shop,
  everyone shares one giant building with paper-thin magic walls between shops.
  A new shop opens in zero seconds and costs nearly nothing. The catch: each
  shop may only think for 10 milliseconds at a time (Free plan) — fine for
  answering questions, too short for building a bicycle (heavy jobs).
- **CPU limits** — "You may think for exactly THIS long, then stop."
  Cloudflare Free: 10 thousandths of a second per request. Enough to answer
  "how much is the car?" Not enough to "count every toy in the warehouse."
- **Serverless** — You don't rent the building at all. You pay a tiny coin each
  time a customer walks in. No customers at 3am = no bill.
- **vCPU / RAM** — Railway's price tags. vCPU = how many toy-helpers you hire.
  RAM = how big your worktable is. Bigger table + more helpers = bigger bill,
  every hour, even at night.
- **Usage-metered** — The taxi meter is always running: helpers + table + toys
  leaving the building, all ticking. Cloudflare's meter ticks far slower (and
  egress is free).

## Guards and locks (security)

- **DDoS** — A million naughty kids blocking your shop door so real customers
  can't enter. Cloudflare is a team of giant bouncers who absorb the crowd for
  free.
- **WAF** — A smart bouncer with a rulebook: "no muddy shoes, no shouting, no
  grabbing." WAF ("web application firewall") blocks known-naughty patterns
  before they reach your shop.
- **JWT** — A stamped hand at a party. You log in once, the guard stamps your
  hand (a long secret code). Every door you open, you show the stamp instead of
  saying the password again. Our admin doors check for the "admin" stamp.
- **API** — The shop's counter with a menu: "I can do THESE things, ask me like
  THIS." Computers order from each other through APIs the way you order food
  through a menu.

## The tools (our code words)

- **Hono** — Our waiter's notepad: a tiny, fast way to write down "when a
  customer asks X, do Y." Works in any restaurant (Cloudflare, Railway,
  anywhere).
- **Drizzle / ORM** — A translator. You speak English ("find the red car under
  50 coins"), it translates into Warehouse Language (SQL) that Postgres
  understands. ORM = "object-relational mapper," the translator's job title.
- **Bindings** — Magic words tied to Cloudflare's kites: `HYPERDRIVE` (the
  warehouse tunnel), `CATALOG_KV` (the drawer wall). Code says the magic word,
  Cloudflare hands over the power. These spells don't work outside
  Cloudflare-land — that's the only lock-in we have.
- **scheduled() / Cron** — A robot alarm clock. "Every hour, on the hour, wake
  up and throw away abandoned shopping baskets." Cron is a timetable written as
  `0 * * * *` (nerd for "top of every hour"). Cloudflare Free allows 5 alarm
  clocks per account — and ours is full.
- **Hobby plan** — Railway's $5/month piggy bank. Already paid for, so it can
  do the alarm-clock job (hourly expiry via a secured endpoint) at $0 new
  spend.
- **Rollback** — "Oops, undo!" Every deploy keeps the previous version, so if
  the new toys are broken you snap back in one click.
- **PR preview** — Before gluing new shelves into the real shop, you build a
  copy in the backyard and invite friends to try it.
- **Lock-in** — Building shelves so they only fit ONE building. Our code is
  mostly building-agnostic (Hono + Drizzle run anywhere); only the bindings tie
  us to Cloudflare.
- **Hybrid** — Two best friends splitting chores: Cloudflare greets customers
  at the fast kiosks; Railway (already paid for) does the hourly tidy-up in
  the back room. Everyone does what they're good at.

## The money words (Ghana shop talk)

- **Pesewas** — Ghana's small coins. 100 pesewas = 1 cedi. Computers hate
  decimal points, so we count everything in whole pesewas — 45000 pesewas,
  never "450.00 cedis." No rounding monsters.
- **MoMo** — Mobile Money. In Ghana, your phone number IS your wallet.
  Customers pay with MTN/Vodafone/AirtelTigo phone credit, not cards.
- **Paystack** — The cashier machine that handles MoMo and cards for us.
  Customer pays → Paystack tells us "money landed" via a secret knock
  (webhook).
- **Webhook** — A secret knock on the back door. "Knock-knock — the payment for
  basket #42 just landed!" Our shop must answer the knock and hand over the
  toys.
- **ATC / offerId** — "Add To Cart." Every buy button must point at an
  **offer** (one seller's price for one toy), never at the toy in general —
  because five sellers can sell the same red car at five prices. The button
  holds the offerId like a name tag: "I want AMA'S red car, not Kofi's."

## The testing words

- **199/199, 82/82** — Our robot taste-testers. 199 little robots try to break
  the API (all passed), 82 try the money math (all passed). When all robots
  smile, we're allowed to ship.
- **tsc** — The grammar teacher. Reads all our code without running it and
  circles spelling mistakes (wrong types). Clean report = no red ink.
- **ECONNRESET** — The warehouse door slamming in our face ("go away!")
  because we sent 75 kids at once. Fixed by sending 2 at a time (per-request
  connection sharing, `requestDbs` in `apps/api/src/index.ts`).

---

**The whole story in one sentence:** Kids in Ghana ask kiosks for toys; kiosks
ask the Ireland warehouse as rarely as possible (sticky notes!); grumpy robots
guard the doors; everything is counted in whole pesewas; and two landlords
split the work so it's fast *and* cheap.
