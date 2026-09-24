# Search and filter engine — practices worth adopting

**Status:** proposed · **Date:** 2026-09-24
**Companions:** [`taxonomy-research-and-design.md`](./taxonomy-research-and-design.md) ·
[`facet-scoping-and-product-mapping.md`](./facet-scoping-and-product-mapping.md)

## Where we start from

- Search today is **Postgres `pg_trgm`** (migration 0031): typo-tolerant
  trigram matching on titles, threshold set per transaction. Honest and cheap.
- **Meilisearch is not wired.** A compose file exists; no API code references it.
- Facet counts are already **server-computed** (`/store/catalog/facets`).
- Workers AI is now bound. **Vectorize is not** — one binding away.

This matters: the modern stack below is reachable on Cloudflare without adding
a search vendor.

## 1. Hybrid retrieval — sparse + dense

Neither keyword nor vector search wins alone. On the WANDS e-commerce
benchmark a tuned hybrid reaches **0.7497 NDCG vs 0.6983 (BM25) and 0.6953
(vector)** — roughly a 7.4% lift over either.

They fail in opposite directions, which is the point:

```
  "Tecno Spark 20 128GB"   exact tokens, rare terms  → sparse wins
  "cheap phone for my mum" paraphrase, intent        → dense wins
```

Concretely for us:

```
  SPARSE   pg_trgm / tsvector   title + brand + model, boosted
  DENSE    Vectorize + Workers AI embeddings (@cf/baai/bge-base-en-v1.5)
           description + attribute values
  FUSE     reciprocal rank fusion, then rerank
```

Two rules from practice:

- **Weight by query length.** 1–2 token queries lean sparse; long natural
  language leans dense. A heuristic is enough before a classifier.
- **Candidate depth 3–5× the result set.** Pull 200–500 sparse candidates for a
  page of 48. Pulling 50 for a top-10 drops items that rank high on keyword and
  mid on vector.

## 2. Query understanding — the highest-leverage piece

Extract structure from the query and turn it into facets, rather than matching
strings:

```
  "8gb lenovo laptop under 2000 in kumasi"
        │
        ▼  NER / attribute extraction
  type=laptop  brand=Lenovo  ram_gb=8  price<200000  region=Ashanti
        │
        ▼
  a FILTERED BROWSE, not a text search — with the chips already applied
```

This is what makes Jiji feel smart, and it is only possible once attributes are
typed: the extractor's target vocabulary *is* the definition list. Another
reason T1/T3 come first.

Show what was understood, and let it be undone — an auto-applied filter the
buyer cannot see or remove is worse than no filter.

## 3. Facets: counts, pruning, ordering

- **Dynamic counts** beside every value. Already implemented server-side.
- **Disable or hide zero-count values** as selections narrow. A filter that
  leads to nothing should not be clickable.
- **Order facets by usefulness, not alphabetically.** Rank by how evenly a
  facet splits the current result set — a facet where one value holds 95% of
  results teaches the buyer nothing. Highest-signal facets first, niche ones
  collapsed, especially on mobile.
- **Cap visible values** (~8) with "show more"; 40 brands is a scroll, not a
  filter.
- **Real-time results on desktop; explicit apply on mobile**, with the result
  count on the apply button — the standard tray pattern.

## 4. Zero results must recover, never dead-end

Never a bare "No products". Name the blocking filter and offer the relaxation:

```
  No results for  Lenovo · 8 GB · Foreign Used · Kumasi

  ↳ Removing  Foreign Used  gives 14 results      [ Remove ]
  ↳ Widening  Kumasi → Ashanti  gives 31 results  [ Widen  ]
```

Requires computing counts for the result set minus each single filter — cheap,
and it converts a dead end into a choice. Our storefront currently shows
"No products. Try another department or clear filters", which puts the work on
the buyer.

## 5. Ranking is multi-signal

Text relevance alone is not ranking. Blend, in this order of trust:

```
  1  text relevance      hybrid score
  2  eligibility         in stock · seller open · delivers to buyer's district
  3  trust               verification tier, fulfilment history
  4  behaviour           CTR / conversion for the query — earned, not assumed
  5  business            sponsored — LABELLED, never silently reordering
```

Rule already in the Phase 3 blueprint and worth restating: paid placement is
labelled and additive, never a silent substitution for the buyer's chosen offer.

## 6. Ghana-specific, and where the real edge is

Generic engines rank on price and relevance. Here, **deliverability outranks
price**:

- A cheaper offer that cannot reach Tamale is not a better offer.
- `region`/`district` should be a first-class ranking signal, not just a facet.
- Offers outside the buyer's delivery area rank below, never hidden — the buyer
  may still want to see them.
- Condition (`Brand New / Refurbished / Local Used / Foreign Used`) is a
  ranking axis, not only a filter.

## 7. Sequence

```
  Q1  facet UX: dynamic counts, zero-count pruning, value cap, mobile tray
  Q2  zero-result recovery with per-filter relaxation counts
  Q3  facet ordering by split quality
  Q4  query understanding → auto-applied, visible, removable chips
  Q5  Vectorize + Workers AI embeddings; hybrid fusion behind a flag
  Q6  multi-signal ranking with deliverability
```

Q1–Q3 need no new infrastructure and no new data — they improve what already
renders. Q4 needs typed attributes (T1/T3). Q5 needs the Phase 2A search
projection/outbox so the index has a source of truth to rebuild from.

## 8. Explicit non-goals

- Replacing `pg_trgm` before hybrid proves itself on real queries.
- A search index that becomes the authority for price, stock or publication —
  the architecture doc already forbids this.
- Auto-applied query filters the buyer cannot see or remove.
- Sponsored results that silently replace organic ranking.

## Sources

- [Hybrid search: BM25, vector & reranking reference 2026](https://www.digitalapplied.com/blog/hybrid-search-bm25-vector-reranking-reference-2026)
- [Ecommerce search: keyword to AI product discovery](https://medium.com/@skalrd/ecommerce-search-keyword-to-ai-product-discovery-with-semantic-search-vectors-and-multi-signal-fce07127b152)
- [Query understanding in ecommerce](https://wizzy.ai/blog/query-understanding-in-ecommerce/)
- [Exploring query understanding for Amazon product search](https://arxiv.org/pdf/2408.02215)
- [Baymard — ecommerce filter UI](https://baymard.com/blog/ecommerce-filter-ui)
- [NN/g — mobile faceted search with a tray](https://www.nngroup.com/articles/mobile-faceted-search/)
- [Faceted search best practices](https://www.fact-finder.com/blog/faceted-search/)
