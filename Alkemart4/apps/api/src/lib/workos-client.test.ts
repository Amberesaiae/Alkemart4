import { describe, expect, it, vi } from "vitest"
import { createWorkosChallenge, exchangeWorkosCode, refreshWorkosSession, workosAuthorizationUrl } from "./workos-client"

const config = { apiKey: "test-secret", clientId: "client_test" }
const verifier = "a".repeat(43)
const success = {
  user: { id: "user_test", email: "buyer@example.com", email_verified: true, metadata: { role: "admin" } },
  access_token: `e30.${btoa(JSON.stringify({ sub: "user_test", sid: "session_test", exp: Math.floor(Date.now() / 1000) + 300 }))}.signature`, refresh_token: "rotated-refresh",
}
function mockResponse(body: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }))
}

describe("WorkOS backend transport", () => {
  it("generates random state and S256 PKCE challenges", async () => {
    const first = await createWorkosChallenge()
    const second = await createWorkosChallenge()
    expect(first.state).toHaveLength(43)
    expect(first.verifier).toHaveLength(43)
    expect(first.state).not.toBe(second.state)
    expect(first.verifier).not.toBe(second.verifier)
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(first.verifier))
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    expect(first.challenge).toBe(expected)
  })

  it("uses hosted AuthKit with state and PKCE, not the API secret", () => {
    const url = new URL(workosAuthorizationUrl({ clientId: config.clientId, redirectUri: "http://127.0.0.1:8787/store/auth/workos/callback", state: verifier, challenge: verifier }))
    expect(url.searchParams.get("provider")).toBe("authkit")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("state")).toBe(verifier)
    expect(url.href).not.toContain(config.apiKey)
  })

  it.each(["http://example.com/callback", "https://user:pass@example.com/callback", "https://example.com/callback?next=evil", "https://example.com/callback#fragment"])("rejects unsafe callback %s", (redirectUri) => {
    expect(() => workosAuthorizationUrl({ clientId: config.clientId, redirectUri, state: verifier, challenge: verifier })).toThrow()
  })

  it("exchanges code server-side and discards all provider authorization metadata", async () => {
    const fetcher = mockResponse(success)
    const result = await exchangeWorkosCode(config, "one-use-code", verifier, fetcher)
    expect(result).toMatchObject({ user: { id: "user_test", email: "buyer@example.com", emailVerified: true }, accessToken: success.access_token, refreshToken: "rotated-refresh", providerSessionId: "session_test" })
    const request = fetcher.mock.calls[0]![1]!
    expect(JSON.parse(request.body as string)).toEqual({ client_id: "client_test", client_secret: "test-secret", grant_type: "authorization_code", code: "one-use-code", code_verifier: verifier })
    expect(request.redirect).toBe("error")
  })

  it("returns rotated refresh credentials without falling back to local authentication", async () => {
    const fetcher = mockResponse(success)
    await refreshWorkosSession(config, "old-refresh", fetcher)
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string).grant_type).toBe("refresh_token")
  })

  it.each([400, 401, 429, 503])("sanitizes provider error %s", async (status) => {
    const fetcher = mockResponse({ message: "test-secret old-refresh private-user-data" }, status)
    await expect(refreshWorkosSession(config, "old-refresh", fetcher)).rejects.toThrow(status >= 500 || status === 429 ? "unavailable" : "rejected")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("sanitizes network errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("test-secret"))
    await expect(exchangeWorkosCode(config, "code", verifier, fetcher)).rejects.toThrow("WorkOS authentication unavailable")
  })

  it.each([{ ...success, user: { ...success.user, email_verified: false } }, { ...success, impersonator: { email: "admin@example.com" } }])("rejects unverified or impersonated identities", async (body) => {
    await expect(exchangeWorkosCode(config, "code", verifier, mockResponse(body))).rejects.toThrow("rejected")
  })

  it("rejects malformed successful responses", async () => {
    await expect(exchangeWorkosCode(config, "code", verifier, mockResponse({ user: success.user }))).rejects.toThrow("invalid_response")
  })
})
