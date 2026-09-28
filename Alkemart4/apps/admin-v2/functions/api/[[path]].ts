/** Same-origin bridge: Access authenticates this Pages host; the API verifies
 * the signed assertion again, so direct workers.dev requests cannot bypass it. */
export const onRequest: PagesFunction = async ({ request, params }) => {
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion")
  if (!assertion) return Response.json({ error: "access_required" }, { status: 403 })
  const rawPath = params.path
  const segments = Array.isArray(rawPath) ? rawPath : typeof rawPath === "string" ? [rawPath] : []
  if (segments[0] !== "admin" || segments.some((part) => part === "." || part === ".." || part.includes("/"))) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }
  const upstream = new URL(request.url)
  upstream.hostname = "alkemart-api.glean-circular-passport.workers.dev"
  upstream.pathname = `/${segments.map(encodeURIComponent).join("/")}`
  const headers = new Headers(request.headers)
  headers.delete("cookie")
  headers.delete("host")
  headers.set("Cf-Access-Jwt-Assertion", assertion)
  const response = await fetch(upstream, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  })
  const outputHeaders = new Headers(response.headers)
  outputHeaders.delete("set-cookie")
  outputHeaders.set("Cache-Control", "no-store")
  return new Response(response.body, { status: response.status, headers: outputHeaders })
}
