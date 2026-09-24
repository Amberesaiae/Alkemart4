import type { Context } from "hono"
import { catalogDb, primaryDb } from "../db"
import { type ApiEnv, parseEnv } from "../env"

type Scope = {
  env?: ApiEnv
  catalog?: ReturnType<typeof catalogDb>
  primary?: ReturnType<typeof primaryDb>
}

/**
 * Per-request memo. Hono builds one Context per request, so keying a WeakMap
 * on it gives request scope with no Variables plumbing and no cross-request
 * leakage (Workers forbids reusing I/O objects across requests).
 */
const scopes = new WeakMap<object, Scope>()

function scopeOf(c: object): Scope {
  let s = scopes.get(c)
  if (!s) {
    s = {}
    scopes.set(c, s)
  }
  return s
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = Context<any>

export function envOf(c: AnyCtx): ApiEnv {
  const s = scopeOf(c)
  return (s.env ??= parseEnv(c.env as unknown as Record<string, unknown>))
}

/** Cached-read pool (HYPERDRIVE). One client per request, reused by every store. */
export function catalogOf(c: AnyCtx) {
  const s = scopeOf(c)
  return (s.catalog ??= catalogDb(envOf(c)))
}

/** Read-after-write pool (HYPERDRIVE_PRIMARY). One client per request. */
export function primaryOf(c: AnyCtx) {
  const s = scopeOf(c)
  return (s.primary ??= primaryDb(envOf(c)))
}

/**
 * Defer construction until a route actually touches the store. Binding
 * middleware mounts ~10 stores per request but a handler uses one or two;
 * eager construction opened a Postgres client per store (Hyperdrive allows
 * only 20 origin connections per config). Methods are bound to the real
 * instance so `this` never becomes the proxy.
 */
export function lazy<T extends object>(factory: () => T): T {
  let instance: T | null = null
  const resolve = (): T => (instance ??= factory())
  return new Proxy({} as T, {
    get(_target, prop) {
      const inst = resolve() as Record<PropertyKey, unknown>
      const value = inst[prop]
      return typeof value === "function" ? value.bind(inst) : value
    },
    has: (_target, prop) => prop in (resolve() as object),
    getPrototypeOf: () => Reflect.getPrototypeOf(resolve() as object),
  })
}
