// @vitest-environment happy-dom
import { beforeEach, expect, it } from "vitest"
import { readSession, writeSession } from "./session"

const key = "alkemart_admin_session"
function session(exp?: number) {
  return { token: `header.${btoa(JSON.stringify({ exp }))}.signature`, user: { id: "test-operator", email: "ops@example.test", role: "admin" } }
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

it("stores sessions only in tab-scoped storage and discards persistent legacy tokens", () => {
  const s = session(Math.floor(Date.now() / 1000) + 3600)
  localStorage.setItem(key, JSON.stringify(s))
  expect(readSession()).toBeNull()
  expect(localStorage.getItem(key)).toBeNull()
  writeSession(s)
  expect(localStorage.getItem(key)).toBeNull()
  expect(readSession()).toEqual(s)
  writeSession(null)
  expect(readSession()).toBeNull()
})

it("discards expired and expiry-less sessions", () => {
  for (const exp of [undefined, Math.floor(Date.now() / 1000) - 1]) {
    writeSession(session(exp))
    expect(readSession()).toBeNull()
    expect(sessionStorage.getItem(key)).toBeNull()
  }
})
