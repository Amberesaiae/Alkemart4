import { describe, expect, it } from "vitest"
import { allowancePeriod, parseVideoLink } from "../videos"

describe("parseVideoLink", () => {
  it("accepts the usual share links and rebuilds safe embed URLs", () => {
    expect(parseVideoLink("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({ platform: "youtube", videoId: "dQw4w9WgXcQ", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" })
    expect(parseVideoLink("youtube.com/shorts/abcDEF12345").videoId).toBe("abcDEF12345")
    expect(parseVideoLink("https://m.youtube.com/watch?v=abcDEF12345&t=3").videoId).toBe("abcDEF12345")
    expect(parseVideoLink("https://www.tiktok.com/@accramart/video/7301234567890123456?lang=en")).toMatchObject({ platform: "tiktok", embedUrl: "https://www.tiktok.com/embed/v2/7301234567890123456" })
    expect(parseVideoLink("https://www.instagram.com/reel/C8abcDEFg12/?igsh=x")).toMatchObject({ platform: "instagram", videoId: "C8abcDEFg12" })
  })
  it("refuses other sites, scripts and non-video pages in plain words", () => {
    expect(() => parseVideoLink("https://evil.example/video/1")).toThrow(/Only TikTok, Instagram and YouTube/)
    expect(() => parseVideoLink("javascript:alert(1)")).toThrow()
    expect(() => parseVideoLink("https://youtube.com/watch?v=<script>")).toThrow(/single video/)
    expect(() => parseVideoLink("https://vm.tiktok.com/ZMabc/")).toThrow(/Only TikTok, Instagram and YouTube|full TikTok/)
    expect(() => parseVideoLink("https://www.tiktok.com/@accramart")).toThrow(/full TikTok video link/)
  })
  it("monthly allowance period is in the market's clock", () => {
    expect(allowancePeriod(new Date("2026-09-30T23:30:00Z"), 60)).toBe("2026-10")
    expect(allowancePeriod(new Date("2026-09-30T23:30:00Z"), 0)).toBe("2026-09")
  })
})
