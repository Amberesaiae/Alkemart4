import { describe, expect, it } from "vitest";
import { parseRecentlyViewed } from "../recently-viewed";

describe("recently viewed storage", () => {
  it("fails closed for malformed values", () => {
    expect(parseRecentlyViewed(null)).toEqual([]);
    expect(parseRecentlyViewed("not-json")).toEqual([]);
    expect(parseRecentlyViewed('{"id":"one"}')).toEqual([]);
  });

  it("keeps only valid ids and caps the history", () => {
    const value = JSON.stringify([
      ...Array.from({ length: 14 }, (_, i) => `p-${i}`),
      null,
      4,
    ]);
    expect(parseRecentlyViewed(value)).toEqual(
      Array.from({ length: 12 }, (_, i) => `p-${i}`),
    );
  });
});
