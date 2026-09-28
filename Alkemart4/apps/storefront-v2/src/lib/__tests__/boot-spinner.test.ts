import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

it("isolates boot spinner dimensions from late-arriving shared mark CSS", () => {
  const html = readFileSync("index.html", "utf8")
  const bootMarkup = html.slice(html.indexOf('<div id="root">'), html.indexOf("<noscript>"))
  const parsed = new DOMParser().parseFromString(bootMarkup, "text/html")
  const wrapper = parsed.querySelector(".boot-mark")!
  expect(wrapper.classList.contains("brand-loading-mark")).toBe(false)
  expect(wrapper.querySelector(":scope > .brand-loading-mark")).not.toBeNull()
  expect(html).toMatch(/\.boot-mark\s*\{\s*width: 44px; height: 44px;/)
  expect(wrapper.querySelectorAll("img")).toHaveLength(6)
})
