import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { BottomTabBar } from "../BottomTabBar"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    ...rest
  }: {
    children: React.ReactNode
    to: string
    search?: { deals?: string }
    "data-testid"?: string
    className?: string
  }) => (
    <a
      href={search?.deals === "1" ? `${to}?deals=1` : to}
      data-testid={rest["data-testid"]}
      className={rest.className}
    >
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string; searchStr: string } }) => unknown }) =>
    select({ location: { pathname: "/", searchStr: "" } }),
}))

describe("BottomTabBar", () => {
  it("renders four tabs and Offers goes to /search?deals=1", () => {
    render(<BottomTabBar />)
    expect(screen.getByTestId("tab-home")).toBeTruthy()
    expect(screen.getByTestId("tab-offers")).toBeTruthy()
    expect(screen.getByTestId("tab-search")).toBeTruthy()
    expect(screen.getByTestId("tab-account")).toBeTruthy()
    expect(screen.getAllByRole("link")).toHaveLength(4)
    expect(screen.getByTestId("tab-offers").getAttribute("href")).toBe("/search?deals=1")
  })
})
