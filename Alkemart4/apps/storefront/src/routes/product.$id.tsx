import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui";
import { Price } from "@/components/price";
import { ProductCard } from "@/components/product-card";
import { ProductGridShell } from "@/components/product-grid";
import { SellerChip } from "@/components/seller-chip";
import { ProductCardSkeleton, ProductGridSkeleton, Shimmer } from "@/components/skeleton";
import { QtyStepper } from "@/components/qty-stepper";
import { PeerOffersList } from "@/components/product/PeerOffersList";
import { ProductBuyPanel } from "@/components/product/ProductBuyPanel";
import { WishlistButton } from "@/components/product/WishlistButton";
import { ProductAttributes } from "@/components/product/ProductAttributes";
import { HomeRecentlyViewed } from "@/components/home/HomeRecentlyViewed";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { BottomBar } from "@/components/bottom-bar";
import { ErrorAlert } from "@/components/error-alert";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { PdpDeliveryCard, PdpSellerCard } from "@/components/product/PdpRailCards";
import { PdpShareRow } from "@/components/product/PdpShareRow";
import { PdpSpecs } from "@/components/product/PdpSpecs";
import { PdpStickyNav } from "@/components/product/PdpStickyNav";
import { ShoppingCart } from "@phosphor-icons/react";
import type { StoreVendorDetail } from "@/lib/vendors";
import { addOfferToCart } from "@/lib/cart";
import { cardRating } from "@/lib/product-rating";
import {
  alertsAvailable,
  createSubscription,
} from "@/lib/notifications";
import { getWorkersAccessToken } from "@/lib/auth";
import {
  getPeerComparison,
  getStoreProduct,
  listRelatedProducts,
  listSimilarAlternatives,
  listStoreCategories,
  listStoreProducts,
  type PeerSort,
} from "@/lib/products";
import { useSlowLoad } from "@/hooks/use-slow-load";
import { getStoreVendorBySlug } from "@/lib/vendors";
import {
  trackAlternativeSelected,
  trackComparisonOpened,
  trackOfferSelected,
  trackProductAdded,
  trackProductViewed,
  trackVariantSelected,
} from "@/lib/analytics";
import { PageSeo } from "@/components/page-seo";
import { rememberRecentlyViewed } from "@/lib/recently-viewed";
import {
  breadcrumbJsonLd,
  productJsonLd,
  stripHtml,
  truncateMeta,
} from "@/lib/seo";

export const Route = createFileRoute("/product/$id")({
  component: ProductDetailPage,
});

/**
 * Price & stock alerts (Phase 7B). Signed-in buyers only — the contact
 * comes from their own order history, never from a form. One-shot: firing
 * deletes the subscription.
 */
function NotifyMeBlock({
  productId,
  offerId,
  outOfStock,
}: {
  productId: string
  offerId: string | null
  outOfStock: boolean
}) {
  const [target, setTarget] = useState("");
  const [note, setNote] = useState<string | null>(null);
  if (!alertsAvailable()) return null;
  const signedIn = typeof window !== "undefined" && Boolean(getWorkersAccessToken());
  const sub = useMutation({
    mutationFn: (input: { kind: "back_in_stock" | "price_drop"; belowPesewas?: string | null }) =>
      createSubscription({ productId, offerId, ...input }),
    onSuccess: (_d, v) =>
      setNote(
        v.kind === "back_in_stock"
          ? "Saved — we'll text you when it's back."
          : "Saved — we'll text you if it drops below your target.",
      ),
    onError: (e) => setNote(e instanceof Error ? e.message : "Couldn't save the alert."),
  });
  if (!outOfStock) return null;
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-foreground">Price & stock alerts</h2>
      {!signedIn ? (
        <p className="text-xs text-muted-foreground">
          <Link
            to="/signin"
            search={{ mode: "login", redirect: `/product/${productId}` }}
            className="font-bold text-primary hover:underline"
          >
            Sign in
          </Link>{" "}
          to get restock and price-drop texts. Alerts go to the phone on your orders.
        </p>
      ) : (
        <div className="space-y-2">
          {outOfStock ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              disabled={sub.isPending}
              onClick={() => sub.mutate({ kind: "back_in_stock" })}
            >
              Notify me when back in stock
            </Button>
          ) : null}
          {offerId ? (
            <div className="flex gap-2">
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                inputMode="decimal"
                placeholder="Target GH₵ (e.g. 899.99)"
                aria-label="Price target in cedis"
                className="h-9 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl whitespace-nowrap"
                disabled={sub.isPending || !target.trim()}
                onClick={() => {
                  const n = Number(target.replace(/[^0-9.]/g, ""));
                  if (!Number.isFinite(n) || n <= 0) {
                    setNote("Enter a target price above zero.");
                    return;
                  }
                  sub.mutate({
                    kind: "price_drop",
                    belowPesewas: String(Math.round(n * 100)),
                  });
                }}
              >
                Alert me
              </Button>
            </div>
          ) : null}
          {note ? (
            <p className="text-xs text-muted-foreground" role="status">
              {note}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              One text per alert — firing deletes it. Manage them under Account → Alerts.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PDP composition — Hubtel-mall pattern:
 * gallery · info (title/price/variants/offers/details) ·
 * sticky buy box · reviews with breakdown · related.
 */
function ProductDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(1);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [peerSort, setPeerSort] = useState<PeerSort>("total");
  /** comparison_opened fires once per product+sort view, never on refetch. */
  const comparisonFiredRef = useRef<string | null>(null);

  const productQ = useQuery({
    queryKey: ["store", "product", id],
    queryFn: () => getStoreProduct(id),
  });

  const p = productQ.data;
  // Skeleton only when the fetch is genuinely slow — fast cache hits must
  // never flash placeholder chrome.
  const showSkeleton = useSlowLoad(productQ.isLoading);

  useEffect(() => {
    if (!p?.id) return;
    rememberRecentlyViewed(p.id);
    trackProductViewed({
      productId: p.id,
      name: p.title,
      price: p.amount ?? null,
      currency: p.currencyCode ?? null,
      sellerId: p.seller?.id ?? null,
    });
  }, [p?.id, p?.offerId]);

  const peersQ = useQuery({
    queryKey: ["store", "peer-offers", p?.id, peerSort],
    queryFn: () => getPeerComparison(p!.id, { sort: peerSort }),
    // Level C listings carry no comparison claims — skip the peer fetch.
    enabled: Boolean(p?.id) && p?.identity?.comparisonEligible !== false,
  });

  // Full category trail for the breadcrumb (Jumia-grade orientation).
  // Ancestors resolve from the cached category list; unknown links drop out.
  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    staleTime: 300_000,
  });
  const crumbTrail = useMemo(() => {
    const handle = p?.categoryHandles?.[0];
    const list = catsQ.data ?? [];
    if (!handle || !list.length) {
      return p?.categoryLabel
        ? [{ label: p.categoryLabel, to: "/categories/$slug", params: { slug: handle ?? "all" } }]
        : [];
    }
    const byId = new Map(list.map((c) => [c.id, c]));
    const byHandle = new Map(list.map((c) => [(c.handle ?? "").toLowerCase(), c]));
    let node = byHandle.get(handle.toLowerCase());
    const chain: { label: string; to: string; params: { slug: string } }[] = [];
    const seen = new Set<string>();
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      chain.unshift({
        label: node.name,
        to: "/categories/$slug",
        params: { slug: node.handle ?? "all" },
      });
      node = node.parentCategoryId ? byId.get(node.parentCategoryId) : undefined;
    }
    return chain;
  }, [p?.categoryHandles, p?.categoryLabel, catsQ.data]);

  const relatedQ = useQuery({
    queryKey: ["store", "related", p?.id, p?.seller?.id, p?.seller?.name],
    queryFn: async () => {
      // Governed alternatives first (Phase 8A): attribute-aware similars.
      // Legacy same-seller/catalog fallback when the rail comes back empty.
      try {
        const similar = await listSimilarAlternatives(p!.id, 6)
        if (similar.length > 0) return { products: similar, mode: "similar" as const }
      } catch {
        /* fall through to the legacy list */
      }
      return listRelatedProducts({
        excludeProductId: p!.id,
        sellerId: p?.seller?.id,
        sellerName: p?.seller?.name,
        limit: 6,
      })
    },
    enabled: Boolean(p?.id),
  });

  const recentPoolQ = useQuery({
    queryKey: ["store", "products", "recent-pool"],
    queryFn: () => listStoreProducts({ limit: 48 }),
    staleTime: 60_000,
  });

  const pool = useMemo(() => {
    const list = [...(recentPoolQ.data?.products ?? [])];
    if (p && !list.some((item) => item.id === p.id)) {
      list.push(p);
    }
    if (relatedQ.data?.products) {
      for (const rp of relatedQ.data.products) {
        if (!list.some((item) => item.id === rp.id)) {
          list.push(rp);
        }
      }
    }
    return list;
  }, [recentPoolQ.data?.products, p, relatedQ.data?.products]);

  const peerOffers = peersQ.data?.offers ?? [];
  const peersReady = peersQ.isSuccess || peersQ.isError;
  const peerExplanation = peersQ.data?.explanation ?? null;
  // The comparison table rendered (and was therefore seen) — once per view.
  useEffect(() => {
    if (!peersQ.isSuccess || !p?.id) return;
    const key = `${p.id}:${peerSort}`;
    if (comparisonFiredRef.current === key) return;
    comparisonFiredRef.current = key;
    trackComparisonOpened({
      productId: p.id,
      offerCount: peersQ.data?.offers.length ?? 0,
    });
  }, [peersQ.isSuccess, peersQ.data, p?.id, peerSort]);
  // Prefer product.offerCount (CF detail) so we don't auto-select during peer load.
  /** V1 matrix: attribute-first selection resolving to combo offers. */
  const optionTypes = p?.optionTypes ?? [];
  const allCombos = p?.combos ?? [];
  const hasMatrix = optionTypes.length > 0;
  const pdpRating = cardRating(p?.ratingAvg, p?.ratingCount);
  const [comboSel, setComboSel] = useState<Record<string, string>>({});
  const peerIdSet = useMemo(
    () => new Set(peerOffers.map((o) => o.offerId)),
    [peerOffers],
  );
  const comboMatches = (
    combo: { options: Record<string, string> },
    sel: Record<string, string>,
  ) =>
    Object.entries(sel).every(
      ([k, v]) => (combo.options[k] ?? "").toLowerCase() === v.toLowerCase(),
    );
  const matchingCombos = useMemo(
    () => allCombos.filter((c) => comboMatches(c, comboSel)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allCombos, comboSel],
  );
  const comboComplete =
    !hasMatrix ||
    optionTypes.every(
      (t) =>
        comboSel[t.name] &&
        t.values.some(
          (vo) => vo.value.toLowerCase() === comboSel[t.name].toLowerCase(),
        ),
    );
  const comboBuyable = (c: {
    active: boolean;
    availableQty: number;
    offerId: string;
  }) => c.active && c.availableQty > 0 && peerIdSet.has(c.offerId);
  const exactBuyable = comboComplete ? matchingCombos.filter(comboBuyable) : [];
  // Preselect the cheapest buyable combo once peers resolve (anchors lowest price).
  useEffect(() => {
    if (!hasMatrix || !peersReady || Object.keys(comboSel).length > 0) return;
    const finite = allCombos.filter((c) => comboBuyable(c) && c.amount != null);
    finite.sort((a, b) => (a.amount as number) - (b.amount as number));
    const first = finite[0];
    if (!first) return;
    const sel: Record<string, string> = {};
    for (const t of optionTypes) {
      const v = first.options[t.name];
      if (v) sel[t.name] = v;
    }
    setComboSel(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMatrix, peersReady, p?.id]);
  // A stale seller pick must never survive a combination change.
  useEffect(() => {
    if (hasMatrix) setSelectedOfferId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comboSel]);
  const knownOfferCount =
    p?.offerCount ?? (peersReady ? peerOffers.length : null);
  const matchingBuyableIds = useMemo(
    () => new Set(matchingCombos.filter(comboBuyable).map((c) => c.offerId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchingCombos, peerIdSet],
  );
  const matrixPeers = useMemo(
    () =>
      hasMatrix
        ? peerOffers.filter((o) => matchingBuyableIds.has(o.offerId))
        : peerOffers,
    [hasMatrix, peerOffers, matchingBuyableIds],
  );
  const requiresOfferPick = hasMatrix
    ? matrixPeers.length > 1
    : (knownOfferCount ?? 0) > 1;
  const activeOfferId = requiresOfferPick
    ? selectedOfferId
    : selectedOfferId ||
      (hasMatrix
        ? (matrixPeers[0]?.offerId ?? null)
        : p?.offerId || peerOffers[0]?.offerId || null);
  const activePeer = peerOffers.find((o) => o.offerId === activeOfferId);
  /** Newest integrity-trail entry for the selected offer (Phase 3A). */
  const activeHistory = (
    (activePeer && peersQ.data?.priceHistory?.[activePeer.offerId]) ??
    []
  ).filter((m) => m.oldAmount != null && m.createdAt);
  const latestMove = activeHistory[0] ?? null;
  const matrixAmount =
    hasMatrix && comboComplete
      ? matchingCombos.reduce<number | null>(
          (best, c) =>
            c.amount != null && (best == null || c.amount < best)
              ? c.amount
              : best,
          null,
        )
      : null;
  const displayAmount = matrixAmount ?? activePeer?.amount ?? p?.amount ?? null;
  const displayCurrency = activePeer?.currencyCode ?? p?.currencyCode ?? null;
  const displaySeller = activePeer?.seller ?? p?.seller ?? null;
  const galleryImages = useMemo(() => {
    const base = p?.images ?? [];
    if (!hasMatrix) return base;
    const picked: { url: string }[] = [];
    for (const t of optionTypes) {
      const sel = comboSel[t.name];
      const hit = sel
        ? t.values.find((vo) => vo.value.toLowerCase() === sel.toLowerCase())
        : undefined;
      if (hit?.imageUrl && !picked.some((im) => im.url === hit.imageUrl))
        picked.push({ url: hit.imageUrl as string });
    }
    const rest = base.filter((im) => !picked.some((pk) => pk.url === im.url));
    return [...picked, ...rest];
  }, [hasMatrix, optionTypes, comboSel, p?.images]);
  const matrixOk = !hasMatrix || (comboComplete && exactBuyable.length > 0);
  const notifyOfferId = hasMatrix
    ? (matchingCombos[0]?.offerId ?? null)
    : (activeOfferId ?? p?.offerId ?? peerOffers[0]?.offerId ?? null);
  const notifyStock = hasMatrix
    ? comboComplete && exactBuyable.length === 0
    : peersReady && (knownOfferCount ?? 0) === 0;
  const matrixReason = !hasMatrix
    ? null
    : !comboComplete
      ? "Select " +
        (optionTypes.find((t) => !comboSel[t.name])?.name ?? "options")
      : exactBuyable.length === 0
        ? matchingCombos.length > 0 && matchingCombos.every((c) => !c.active)
          ? "This combination is no longer available"
          : "This combination is out of stock"
        : null;

  useEffect(() => {
    // Matrix products resolve through the combination selector instead.
    if (hasMatrix) return;
    // Wait until we know offer count; never auto-pick when multiple sellers.
    if (!peersReady && p?.offerCount == null) return;
    if (requiresOfferPick) return;
    if (!selectedOfferId && (p?.offerId || peerOffers[0]?.offerId)) {
      setSelectedOfferId(p?.offerId || peerOffers[0]?.offerId || null);
    }
  }, [
    peersReady,
    requiresOfferPick,
    p?.offerId,
    p?.offerCount,
    peerOffers,
    selectedOfferId,
  ]);

  // Reset selection when navigating to a different product.
  useEffect(() => {
    setSelectedOfferId(null);
    setComboSel({});
  }, [p?.id]);

  const handleOfferSelect = (offerId: string) => {
    setSelectedOfferId(offerId);
    if (!p?.id) return;
    const peer = peerOffers.find((o) => o.offerId === offerId);
    trackOfferSelected({
      productId: p.id,
      offerId,
      sellerId: peer?.seller.id ?? null,
    });
  };

  /** User-driven combination picks only — the auto-preselect stays silent. */
  const handleComboSelect = (chosen: Record<string, string>) => {
    setComboSel(chosen);
    if (!p?.id) return;
    const signature = Object.entries(chosen)
      .map(([k, v]) => `${k}=${v}`)
      .join(" · ");
    if (signature) trackVariantSelected({ productId: p.id, options: signature });
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!activeOfferId) {
        throw new Error(
          requiresOfferPick
            ? "Select a seller offer before adding to cart"
            : "This item is not available to buy yet",
        );
      }
      return addOfferToCart(activeOfferId, qty);
    },
    onSuccess: () => {
      if (activeOfferId) {
        trackProductAdded({
          productId: p?.id,
          offerId: activeOfferId,
          quantity: qty,
          price: displayAmount,
          currency: displayCurrency,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["store", "cart"] });
    },
  });

  const buyNow = useMutation({
    mutationFn: async () => {
      if (!activeOfferId) {
        throw new Error(
          requiresOfferPick
            ? "Select a seller offer before checkout"
            : "This item is not available to buy yet",
        );
      }
      return addOfferToCart(activeOfferId, qty);
    },
    onSuccess: () => {
      if (activeOfferId) {
        trackProductAdded({
          productId: p?.id,
          offerId: activeOfferId,
          quantity: qty,
          price: displayAmount,
          currency: displayCurrency,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["store", "cart"] });
      void navigate({ to: "/checkout" });
    },
  });

  const canAddBase =
    Boolean(activeOfferId) && (!requiresOfferPick || Boolean(selectedOfferId));

  /** Paused sellers keep listings visible but block checkout server-side —
      the buy panel mirrors that with a disabled CTA + reason. */
  const pauseQ = useQuery({
    queryKey: ["store", "vendor-pause", displaySeller?.handle],
    queryFn: () => getStoreVendorBySlug(displaySeller!.handle as string),
    enabled: Boolean(displaySeller?.handle),
    staleTime: 60_000,
  });
  const pauseInfo = pauseQ.data?.vendor.availability;
  const sellerPaused = pauseInfo?.state === "paused";
  const canAdd = canAddBase && !sellerPaused && matrixOk;
  const pausedReason = sellerPaused
    ? `This shop is paused${pauseInfo?.note ? ` — ${pauseInfo.note}` : ""}${pauseInfo?.pausedUntil ? ` (back ${new Date(pauseInfo.pausedUntil).toLocaleDateString()})` : ""}`
    : null;
  const unavailableReason = pausedReason ?? matrixReason;
  const productPath = `/product/${id}`;

  const sellerVendor: StoreVendorDetail = pauseQ.data?.vendor ?? {
    id: displaySeller?.id ?? "seller",
    name: displaySeller?.name ?? "Marketplace Shop",
    slug: (displaySeller?.handle as string) ?? "seller",
    ratingCount: 0,
    ratingAvgX100: 0,
    trust: {
      ratingAvg: null,
      ratingCount: 0,
      salesCount: 0,
      memberSince: null,
      location: null,
      tagline: null,
      phone: null,
      hours: null,
      social: {},
      announcement: null,
      policy: null,
      recentReviews: [],
    },
  };

  const jsonLd = p?.id
    ? {
        "@context": "https://schema.org",
        "@graph": [
          productJsonLd({
            id: p.id,
            title: p.title,
            description: p.description,
            handle: p.handle,
            thumbnail: p.thumbnail,
            path: productPath,
            brandName: p.identity?.brand ?? null,
            // Peers are sellable by construction (server-filtered), so each
            // row is an InStock, seller-attributed offer — never invented.
            offers: peerOffers
              .filter((o) => o.amount != null && o.currencyCode)
              .map((o) => ({
                price: o.amount as number,
                currencyCode: o.currencyCode as string,
                sellerName: o.seller.name,
                inStock: true as const,
                deliveryFee: o.deliveryAmount ?? null,
              })),
            variants: hasMatrix
              ? allCombos
                  .map((c) => {
                    const sig = Object.entries(c.options ?? {})
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")
                    return sig ? { name: sig } : null
                  })
                  .filter((v): v is { name: string } => v !== null)
              : null,
            rating:
              p.ratingAvg != null && (p.ratingCount ?? 0) > 0
                ? { avg: p.ratingAvg, count: p.ratingCount ?? 0 }
                : null,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            {
              name: p.categoryLabel ?? "Market",
              path: `/categories/${p.categoryHandles?.[0] ?? "all"}`,
            },
            ...(displaySeller?.handle
              ? [
                  {
                    name: displaySeller.name ?? "Seller",
                    path: `/shops/${displaySeller.handle}`,
                  },
                ]
              : []),
            { name: p.title, path: productPath },
          ]),
        ],
      }
    : null;

  return (
    <div className="space-y-10 pb-8">
      {p ? (
        <PageSeo
          title={p.title}
          description={
            p.description
              ? truncateMeta(stripHtml(p.description))
              : displaySeller?.name
                ? `${p.title} from ${displaySeller.name} on alkemart`
                : `${p.title} on alkemart`
          }
          path={productPath}
          image={p.thumbnail}
          type="product"
          jsonLd={jsonLd}
        />
      ) : null}

      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          ...crumbTrail,
          { label: p?.title ?? "Product" },
        ]}
      />

      {showSkeleton ? (
        <div
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start"
          role="status"
          aria-label="Loading product"
          aria-busy="true"
        >
          {/* Main Column Skeleton */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-4">
            {/* 1. Unified Top Product Card Skeleton */}
            <div className="rounded-lg border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left: Gallery Skeleton */}
                <div className="md:col-span-6 space-y-3">
                  <Shimmer className="aspect-square w-full rounded-md border border-border/60 bg-muted/20" />
                  <div className="flex gap-2">
                    <Shimmer className="h-14 w-14 rounded-md border border-border/60" />
                    <Shimmer className="h-14 w-14 rounded-md border border-border/60" />
                    <Shimmer className="h-14 w-14 rounded-md border border-border/60" />
                    <Shimmer className="h-14 w-14 rounded-md border border-border/60" />
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <Shimmer className="h-3.5 w-32" />
                    <div className="flex gap-2">
                      <Shimmer className="h-7 w-7 rounded-full" />
                      <Shimmer className="h-7 w-7 rounded-full" />
                      <Shimmer className="h-7 w-7 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Right: Info Skeleton */}
                <div className="md:col-span-6 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <Shimmer className="h-4 w-28" />
                    <Shimmer className="h-8 w-8 rounded-full" />
                  </div>
                  <Shimmer className="h-6 w-full" />
                  <Shimmer className="h-6 w-3/4" />
                  <Shimmer className="h-4 w-36" />
                  <div className="space-y-2 border-y border-border/40 py-3">
                    <Shimmer className="h-9 w-44" />
                    <Shimmer className="h-4 w-32" />
                  </div>
                  <Shimmer className="h-12 w-full rounded-lg" />
                  <Shimmer className="h-24 w-full rounded-xl" />
                </div>
              </div>
            </div>

            {/* 2. Sponsored Products Carousel Skeleton */}
            <div className="rounded-lg border border-border/80 bg-card p-4 shadow-2xs space-y-3">
              <Shimmer className="h-5 w-40" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            </div>

            {/* 3. Product Details Skeleton */}
            <div className="rounded-lg border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-3">
              <Shimmer className="h-5 w-32" />
              <div className="space-y-2 pt-2">
                <Shimmer className="h-4 w-5/6" />
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-4 w-4/5" />
                <Shimmer className="h-4 w-2/3" />
              </div>
            </div>

            {/* 4. Specifications Skeleton */}
            <div className="rounded-lg border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4">
              <Shimmer className="h-5 w-32" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-md border border-border/60 p-4 space-y-2">
                  <Shimmer className="h-4 w-28" />
                  <Shimmer className="h-3.5 w-full" />
                  <Shimmer className="h-3.5 w-4/5" />
                  <Shimmer className="h-3.5 w-3/4" />
                </div>
                <div className="rounded-md border border-border/60 p-4 space-y-2">
                  <Shimmer className="h-4 w-28" />
                  <Shimmer className="h-3.5 w-full" />
                  <Shimmer className="h-3.5 w-3/4" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Rail Skeleton */}
          <div className="hidden lg:col-span-4 xl:col-span-3 lg:block space-y-4" aria-hidden>
            <div className="rounded-lg border border-border/80 bg-card p-4 shadow-2xs space-y-3">
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-9 w-full rounded-md" />
              <Shimmer className="h-9 w-full rounded-md" />
              <Shimmer className="h-20 w-full rounded-md" />
              <Shimmer className="h-14 w-full rounded-md" />
            </div>
            <div className="rounded-lg border border-border/80 bg-card p-4 shadow-2xs space-y-3">
              <Shimmer className="h-4 w-36" />
              <div className="flex items-center justify-between">
                <Shimmer className="h-5 w-32" />
                <Shimmer className="h-8 w-16 rounded-md" />
              </div>
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-16 w-full rounded-md" />
            </div>
          </div>
        </div>
      ) : null}

      {productQ.isError ? (
        <>
          <PageSeo
            title="Item unavailable"
            description="This item is unavailable or was removed. Browse similar items on alkemart."
            path={productPath}
            noindex
          />
          <ErrorAlert
            message={
              productQ.error instanceof Error
                ? productQ.error.message
                : "Could not load product"
            }
          />
          <p className="text-sm text-muted-foreground">
            This listing is unavailable or was removed — it is never redirected
            to the homepage.{" "}
            <Link
              to="/categories/$slug"
              params={{ slug: p?.categoryHandles?.[0] ?? "all" }}
              className="font-bold text-primary hover:underline"
            >
              Browse similar items
            </Link>
          </p>
        </>
      ) : null}

      {p ? (
        <article className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
          {/* Main Content Column (Left ~75-80%) */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-4">
            {/* 1. Unified Top Product Card */}
            <div className="rounded-lg border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left: Gallery + Share */}
                <div className="md:col-span-6 space-y-4">
                  <ProductImageGallery
                    images={galleryImages}
                    webUrl={p.webUrl}
                    thumbUrl={p.thumbUrl}
                    title={p.title}
                    categoryLabel={p.categoryLabel}
                    categoryHandle={p.categoryHandles?.[0] ?? null}
                  />
                  <PdpShareRow
                    title={p.title}
                    url={typeof window !== "undefined" ? window.location.href : ""}
                  />
                </div>

                {/* Right: Info, Price, Variants, CTA */}
                <div className="md:col-span-6 space-y-3.5">
                  <header className="space-y-1.5 border-b border-border/60 pb-3">
                    {/* Brand and seller attribution */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        {displaySeller ? (
                          <Link
                            to="/shops/$slug"
                            params={{ slug: displaySeller.handle ?? "" }}
                            className="font-bold text-foreground hover:text-primary hover:underline"
                          >
                            Sold by {displaySeller.name}
                          </Link>
                        ) : null}
                        {p.identity?.brand ? (
                          <span className="text-muted-foreground">
                            {displaySeller ? " · " : ""}Brand:{" "}
                            <Link
                              to="/search"
                              search={{ q: p.identity.brand }}
                              className="font-semibold text-foreground hover:underline"
                            >
                              {p.identity.brand}
                            </Link>
                          </span>
                        ) : null}
                      </div>
                      <WishlistButton productId={p.id} />
                    </div>

                    {/* Title */}
                    <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-snug">
                      {p.title}
                    </h1>

                    {/* Ratings */}
                    <div className="flex items-center gap-2 text-xs">
                      {pdpRating ? (
                        <a
                          href="#buyer-reviews"
                          className="inline-flex items-center gap-1.5 font-bold text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={pdpRating.label}
                        >
                          <span aria-hidden className="text-warning text-sm">
                            {"★".repeat(Math.round(p.ratingAvg ?? 5))}
                            {"☆".repeat(5 - Math.round(p.ratingAvg ?? 5))}
                          </span>
                          <span className="text-foreground tabular-nums">({pdpRating.count} {pdpRating.count === 1 ? "rating" : "ratings"})</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">No ratings yet</span>
                      )}
                    </div>
                  </header>

                  {/* Price & Availability Block */}
                  <div className="space-y-1.5 border-b border-border/60 pb-3">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Price
                        amount={displayAmount}
                        currencyCode={displayCurrency}
                        size="lg"
                        className="text-2xl lg:text-3xl font-black text-tone-brand-ink tabular-nums"
                      />
                      {latestMove?.oldAmount && latestMove.oldAmount > (displayAmount ?? 0) ? (
                        <>
                          <span className="text-sm font-semibold text-muted-foreground line-through tabular-nums">
                            <Price
                              amount={latestMove.oldAmount}
                              currencyCode={displayCurrency}
                              size="sm"
                            />
                          </span>
                          <span className="rounded-md bg-tone-scarce px-1.5 py-0.5 text-xs font-bold text-white">
                            -{Math.round(((latestMove.oldAmount - (displayAmount ?? 0)) / latestMove.oldAmount) * 100)}%
                          </span>
                        </>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      {displayAmount != null && matrixOk ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <span className="size-1.5 rounded-full bg-foreground/60" aria-hidden />
                          In stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          Check availability
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Variations / Matrix Options */}
                  {hasMatrix && (
                    <div className="space-y-3 border-b border-border/60 pb-3">
                      {optionTypes.map((t) => (
                        <div key={t.name} className="space-y-1.5">
                          <p className="text-xs font-bold" id={"combo-label-" + t.name}>
                            {t.name}:{" "}
                            <span className="font-semibold text-muted-foreground">
                              {comboSel[t.name] ?? "Select"}
                            </span>
                          </p>
                          <div
                            role="radiogroup"
                            aria-labelledby={"combo-label-" + t.name}
                            className="flex flex-wrap gap-2"
                          >
                            {t.values.map((vo) => {
                              const v = vo.value;
                              const chosen: Record<string, string> = {
                                ...comboSel,
                                [t.name]: v,
                              };
                              const exists = allCombos.some((c) =>
                                comboMatches(c, chosen),
                              );
                              if (!exists) return null;
                              const buyable = allCombos.some(
                                (c) => comboMatches(c, chosen) && comboBuyable(c),
                              );
                              const selected =
                                (comboSel[t.name] ?? "").toLowerCase() ===
                                v.toLowerCase();
                              return (
                                <button
                                  key={v}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  aria-label={t.name + ": " + v + (buyable ? "" : " (out of stock)")}
                                  title={buyable ? v : v + " - out of stock"}
                                  disabled={!buyable}
                                  onClick={() => handleComboSelect(chosen)}
                                  className={
                                    "min-h-9 min-w-9 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors " +
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                                    (selected
                                      ? "border-primary bg-muted text-foreground ring-1 ring-primary"
                                      : "border-border bg-card text-foreground hover:border-primary/60") +
                                    (!buyable ? " cursor-not-allowed opacity-50 line-through" : "")
                                  }
                                >
                                  {vo.imageUrl ? (
                                    <img
                                      src={vo.imageUrl}
                                      alt=""
                                      aria-hidden="true"
                                      className="h-6 w-6 rounded object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    v
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Primary Add to Cart + Qty Stepper */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <QtyStepper
                        value={qty}
                        onChange={setQty}
                        disabled={!canAdd}
                        size="sm"
                      />
                      <Button
                        type="button"
                        size="lg"
                        className="flex-1 min-h-11 font-bold uppercase tracking-wider bg-primary hover:bg-primary-strong text-primary-foreground shadow-2xs flex items-center justify-center gap-2"
                        disabled={!canAdd || add.isPending}
                        onClick={() => add.mutate()}
                      >
                        <ShoppingCart size={18} weight="bold" />
                        <span>{add.isPending ? "Adding…" : add.isSuccess ? "Added ✓" : "Add to cart"}</span>
                      </Button>
                    </div>
                    {unavailableReason && (
                      <p className="text-xs font-semibold text-destructive">{unavailableReason}</p>
                    )}
                  </div>


                  {/* Multivendor Peer Offers */}
                  {p?.identity?.comparisonEligible !== false && (hasMatrix ? matrixPeers : peerOffers).length > 1 ? (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">More seller offers ({peerOffers.length})</span>
                        <div className="flex items-center gap-1" role="group" aria-label="Sort seller offers">
                          {(
                            [
                              ["total", "Total"],
                              ["price", "Price"],
                              ["trust", "Trust"],
                            ] as [PeerSort, string][]
                          ).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setPeerSort(value)}
                              className={
                                "rounded-md px-2 py-0.5 text-[11px] font-bold transition-colors " +
                                (peerSort === value
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted")
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <PeerOffersList
                        offers={hasMatrix ? matrixPeers : peerOffers}
                        activeOfferId={activeOfferId}
                        onSelect={handleOfferSelect}
                        explanation={peerExplanation}
                      />
                    </div>
                  ) : null}

                  {/* Price alert subscription */}
                  <NotifyMeBlock
                    productId={p.id}
                    offerId={notifyOfferId}
                    outOfStock={notifyStock}
                  />
                </div>
              </div>
            </div>

            {/* Mobile-only Delivery & Seller Cards */}
            <div className="space-y-4 lg:hidden">
              <PdpDeliveryCard
                sellerName={displaySeller?.name ?? null}
                location={null}
                area={null}
                deliveryMinutes={pauseQ.data?.vendor.deliveryMinutes ?? null}
                policy={null}
                paused={sellerPaused}
              />
              <PdpSellerCard vendor={sellerVendor} />
            </div>

            {/* 2. Sponsored / Related Products Carousel */}
            {relatedQ.data && relatedQ.data.products.length > 0 ? (
              <section className="rounded-lg border border-border/80 bg-card p-4 shadow-2xs space-y-3">
                <SectionHeader
                  title={
                    relatedQ.data?.mode === "similar"
                      ? "Sponsored products"
                      : relatedQ.data?.mode === "seller" && displaySeller?.name
                        ? `More from ${displaySeller.name}`
                        : "Sponsored products"
                  }
                  actionLabel="See all"
                  actionTo="/categories/$slug"
                  actionParams={{ slug: p.categoryHandles?.[0] ?? "all" }}
                />
                <ProductGridShell>
                  {relatedQ.data.products.slice(0, 6).map((rp) => (
                    <div
                      key={rp.id}
                      className="contents"
                      onClickCapture={(e) => {
                        if (!(e.target instanceof Element)) return;
                        if (!e.target.closest("a") || !p?.id) return;
                        trackAlternativeSelected({
                          productId: p.id,
                          alternativeId: rp.id,
                          source: relatedQ.data?.mode ?? null,
                        });
                      }}
                    >
                      <ProductCard product={rp} size="tile" />
                    </div>
                  ))}
                </ProductGridShell>
              </section>
            ) : null}

            {/* 3. Product Details & Specifications */}
            <PdpSpecs
              attributes={p.attributes ?? []}
              identity={p.identity}
              description={p.description ?? null}
            />

            {/* 4. Customers who viewed this also viewed */}
            {pool.length > 0 ? (
              <section className="rounded-lg border border-border/80 bg-card p-4 shadow-2xs space-y-3">
                <SectionHeader
                  title="Customers who viewed this also viewed"
                  actionLabel="See all"
                  actionTo="/categories/$slug"
                  actionParams={{ slug: "all" }}
                />
                <ProductGridShell>
                  {pool.slice(0, 6).map((rp) => (
                    <ProductCard key={rp.id} product={rp} size="tile" />
                  ))}
                </ProductGridShell>
              </section>
            ) : null}

            {/* 5. Customer Feedback */}
            <section
              id="buyer-reviews"
              aria-label="Customer Reviews"
              className="scroll-mt-24 rounded-lg border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h2 className="text-base font-bold text-foreground">
                  Customer Reviews
                </h2>
                {(p.reviews ?? []).length > 0 ? (
                  <span className="text-xs font-bold text-primary cursor-pointer hover:underline">
                    See All &gt;
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
                {/* Left: Overall score & Star Breakdown */}
                <div className="space-y-4 md:col-span-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ratings ({pdpRating?.count ?? 0})
                  </p>
                  {pdpRating ? (
                    <div className="rounded-lg border border-border/70 bg-muted/25 p-4 text-center">
                      <p className="text-4xl font-black tabular-nums text-foreground">
                        {pdpRating.value}
                        <span className="text-lg font-bold text-muted-foreground">/5</span>
                      </p>
                      <p className="mt-1 text-base font-bold text-warning tabular-nums" aria-hidden>
                        {"★".repeat(Math.round(p.ratingAvg ?? 5))}
                        {"☆".repeat(5 - Math.round(p.ratingAvg ?? 5))}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {pdpRating.count} {pdpRating.count === 1 ? "rating" : "ratings"}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-5 text-center text-xs text-muted-foreground">
                      No ratings recorded yet for this product.
                    </div>
                  )}

                  <ol className="grid gap-1.5" aria-label="Rating breakdown">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const total = (p.reviews ?? []).length || 1;
                      const n = (p.reviews ?? []).filter((r) => r.rating === star).length;
                      const pct = Math.round((n / total) * 100);
                      return (
                        <li
                          key={star}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <span className="w-6 shrink-0 font-bold tabular-nums">{star}★</span>
                          <span
                            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                            aria-hidden
                          >
                            <span
                              className="block h-full rounded-full bg-warning"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span className="w-8 shrink-0 text-right tabular-nums font-semibold">
                            ({n})
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {/* Right: Comments from verified purchases */}
                <div className="space-y-4 md:col-span-8">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Customer Comments ({(p.reviews ?? []).length})
                  </p>
                  {(p.reviews ?? []).length > 0 ? (
                    <ul className="divide-y divide-border/60">
                      {(p.reviews ?? []).map((r, i) => (
                        <li key={i} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                          <div className="flex items-center gap-1 text-warning text-xs">
                            {"★".repeat(r.rating)}
                            {"☆".repeat(5 - r.rating)}
                          </div>
                          {r.title ? <p className="font-bold text-sm text-foreground">{r.title}</p> : null}
                          <p className="text-xs leading-relaxed text-muted-foreground">{r.body}</p>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                            <span>
                              {new Date(r.createdAt).toLocaleDateString()} by Customer
                            </span>
                            <span className="font-medium text-muted-foreground">
                              Verified purchase
                            </span>
                          </div>
                          {r.vendorResponse ? (
                            <div className="mt-2 rounded-lg bg-muted/40 border p-2.5 text-xs">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                                Seller reply
                              </p>
                              <p className="text-foreground">{r.vendorResponse}</p>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-lg border border-border/70 bg-muted/10 p-6 text-center text-xs text-muted-foreground">
                      <p className="font-bold text-foreground mb-1">No customer reviews yet</p>
                      <p>Buy this item and be the first to share your experience with other shoppers!</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 6. More items from this seller */}
            {relatedQ.data && relatedQ.data.products.length > 6 ? (
              <section className="rounded-lg border border-border/80 bg-card p-4 shadow-2xs space-y-3">
                <SectionHeader
                  title={displaySeller?.name ? `More items from ${displaySeller.name}` : "More items from this seller"}
                  actionLabel="See all"
                  actionTo="/shops/$slug"
                  actionParams={{ slug: displaySeller?.handle ?? "seller" }}
                />
                <ProductGridShell>
                  {relatedQ.data.products.slice(6, 12).map((rp) => (
                    <ProductCard key={rp.id} product={rp} size="tile" />
                  ))}
                </ProductGridShell>
              </section>
            ) : null}

            {/* 7. Recently Viewed */}
            <HomeRecentlyViewed products={pool} inCard />
          </div>

          {/* Right Rail Column (~20-25%) */}
          <div className="hidden lg:col-span-4 xl:col-span-3 lg:block space-y-4">
            <PdpDeliveryCard
              sellerName={displaySeller?.name ?? null}
              location={null}
              area={null}
              deliveryMinutes={pauseQ.data?.vendor.deliveryMinutes ?? null}
              policy={null}
              paused={sellerPaused}
            />
            <PdpSellerCard vendor={sellerVendor} />
            <PdpStickyNav
              product={{
                id: p.id,
                title: p.title,
                thumbnail: p.thumbnail ?? null,
                amount: displayAmount,
                currencyCode: displayCurrency,
              }}
              canAdd={canAdd}
              isPending={add.isPending}
              onAddToCart={() => add.mutate()}
              sellerName={displaySeller?.name}
              sellerHandle={displaySeller?.handle}
              sellerWhatsApp={
                sellerVendor.trust?.social?.whatsapp ?? sellerVendor.trust?.phone ?? null
              }
            />
          </div>
        </article>
      ) : null}

      {p ? (
        <BottomBar>
          <QtyStepper
            value={qty}
            onChange={setQty}
            disabled={!canAdd}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <Price
              amount={displayAmount}
              currencyCode={displayCurrency}
              size="sm"
            />
          </div>
          <Button
            type="button"
            size="lg"
            className="min-h-11 min-w-[7.5rem] shrink-0 font-bold"
            disabled={!canAdd || add.isPending}
            onClick={() => add.mutate()}
          >
            {add.isPending ? "…" : add.isSuccess ? "Added ✓" : "Add"}
          </Button>
        </BottomBar>
      ) : null}
    </div>
  );
}
