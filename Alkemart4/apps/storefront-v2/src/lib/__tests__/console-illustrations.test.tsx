import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { EmptyState } from "@workspace/console-ui/components/console/states"

afterEach(cleanup)

it("supports compact console artwork without changing state copy or actions", () => {
  let clicked = false
  const { container } = render(<EmptyState illustration="first-listing" illustrationSize="compact"
    title="No views yet" description="Share your shop link."
    action={<button onClick={() => { clicked = true }}>Share shop</button>} />)
  const img = container.querySelector("img")!
  expect(img.className).toContain("size-28")
  expect(img.getAttribute("alt")).toBe("")
  expect(img.getAttribute("aria-hidden")).toBe("true")
  expect(screen.getByText("Share your shop link.")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Share shop" }))
  expect(clicked).toBe(true)
  fireEvent.error(img)
  expect(container.querySelector("img")).toBeNull()
  expect(screen.getByText("No views yet")).toBeTruthy()
})

it("keeps unmatched artwork optional for operational states", () => {
  const { container } = render(<EmptyState title="No payouts yet" />)
  expect(container.querySelector("img")).toBeNull()
})
