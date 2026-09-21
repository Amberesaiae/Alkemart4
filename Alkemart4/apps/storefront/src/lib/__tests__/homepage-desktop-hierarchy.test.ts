import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const offersSource = readFileSync(
  resolve(__dirname, "../../components/home/HomeLastOffers.tsx"),
  "utf8",
);
const courseSource = readFileSync(
  resolve(__dirname, "../../components/home/HomepageSections.tsx"),
  "utf8",
);

describe("desktop Mowafer homepage hierarchy", () => {
  it("keeps every grid-mode offer at one consistent product-card size", () => {
    expect(offersSource).toContain(
      '<ProductGridShell className="lg:grid-cols-5 lg:gap-3">',
    );
    expect(offersSource).toContain("visible.map((product)");
    expect(offersSource).toContain('size="tile"');
    expect(offersSource).not.toContain("visible[0]");
    expect(offersSource).not.toContain("visible.slice(2, 4)");
  });

  it("keeps the desktop course focused on categories and one offer decision area", () => {
    expect(courseSource).toContain(
      'section.type === "category_grid" || section.id === desktopDecisionId',
    );
    expect(courseSource).toContain(
      'className={desktopPrimary ? undefined : "lg:hidden"}',
    );
  });

  it("follows promotion with product, seller, and category merchandising", () => {
    expect(courseSource).toContain("const desktopPromoBand = live.find(");
    expect(courseSource).toContain("const desktopStoreRail = live.find(");
    expect(courseSource).toContain("<MerchPromoBand {...desktopPromoBand} />");
    expect(
      courseSource.indexOf("<MerchPromoBand {...desktopPromoBand} />"),
    ).toBeLessThan(
      courseSource.indexOf("<HomePopularRail products={products} />"),
    );
    expect(
      courseSource.indexOf("<HomePopularRail products={products} />"),
    ).toBeLessThan(
      courseSource.indexOf("<HomeFeaturedShop products={products} />"),
    );
    expect(
      courseSource.indexOf("<HomeFeaturedShop products={products} />"),
    ).toBeLessThan(
      courseSource.indexOf(
        'section={{ ...desktopStoreRail, layout: "carousel", limit: 8 }}',
      ),
    );
    expect(
      courseSource.indexOf(
        'section={{ ...desktopStoreRail, layout: "carousel", limit: 8 }}',
      ),
    ).toBeLessThan(
      courseSource.indexOf("<HomeCategoryRail categories={categories} />"),
    );
    expect(
      courseSource.indexOf("<HomeCategoryRail categories={categories} />"),
    ).toBeLessThan(courseSource.indexOf("<HomeAdvertiseBand />"));
    expect(courseSource).not.toContain("<HomeDeliveryBand />");
    expect(courseSource).not.toContain("<HomeRecentlyViewed");
    expect(courseSource.indexOf("<HomeAdvertiseBand />")).toBeGreaterThan(-1);
  });
});
