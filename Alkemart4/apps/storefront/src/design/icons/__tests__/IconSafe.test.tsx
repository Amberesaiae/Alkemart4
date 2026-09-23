import { describe, it, expect } from "vitest"
import { renderToString } from "react-dom/server"
import { IconSafe, Icon } from "../Icon"
import { ICON_IDS } from "../types"

describe("IconSafe & Icon", () => {
  it("renders all canonical ICON_IDS without crashing or returning undefined", () => {
    for (const id of ICON_IDS) {
      expect(() => {
        const html = renderToString(<IconSafe name={id} />)
        expect(typeof html).toBe("string")
        expect(html.length).toBeGreaterThan(0)
      }).not.toThrow()
    }
  })

  it("safely renders chevron-left", () => {
    const html = renderToString(<IconSafe name="chevron-left" />)
    expect(html).toContain("svg")
  })

  it("safely falls back without throwing when an unknown icon is passed", () => {
    // @ts-expect-error test runtime fallback for unregistered icon
    const html = renderToString(<IconSafe name="unknown-icon-test" />)
    expect(html).toContain("svg")
  })
})
