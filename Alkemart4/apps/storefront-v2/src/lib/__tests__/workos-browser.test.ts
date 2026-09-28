import { afterEach, describe, expect, it, vi } from "vitest"
import { WorkosBrowser } from "@workspace/console-ui/lib/workos-browser"

const session = () => ({ token: `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 300 }))}.signature`, user: { id: "buyer", email: "buyer@example.com", role: "buyer" } })
afterEach(() => vi.unstubAllGlobals())
describe("shared marketplace browser session", () => {
  it("single-flights concurrent restores and holds access only in memory", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(session()))
    vi.stubGlobal("fetch", fetcher)
    const browser = new WorkosBrowser(() => "https://shop.pages.dev", "store")
    const results = await Promise.all([browser.restore(), browser.restore()])
    expect(results[0]).toEqual(results[1])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]![1].credentials).toBe("include")
  })
  it("does not resurrect a delayed restore after logout", async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve })).mockResolvedValueOnce(Response.json({ ok: true }))
    vi.stubGlobal("fetch", fetcher)
    const browser = new WorkosBrowser(() => "https://shop.pages.dev", "store")
    const restoring = browser.restore()
    await browser.logout()
    finish(Response.json(session()))
    expect(await restoring).toBeNull()
    expect(browser.peek()).toBeNull()
  })
  it("clears memory when the server revokes the session", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(session())).mockResolvedValueOnce(new Response(null, { status: 401 }))
    vi.stubGlobal("fetch", fetcher)
    const browser = new WorkosBrowser(() => "https://shop.pages.dev", "store")
    await browser.restore()
    expect(await browser.restore(true)).toBeNull()
    expect(browser.peek()).toBeNull()
  })
})
