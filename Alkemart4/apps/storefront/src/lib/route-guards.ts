import { redirect } from "@tanstack/react-router"
import { getSessionCustomer } from "./auth"

export async function requireAuth() {
  const customer = await getSessionCustomer()
  if (!customer) {
    throw redirect({ to: "/login", search: { redirect: location.pathname } })
  }
  return customer
}

export async function requireGuest() {
  const customer = await getSessionCustomer()
  if (customer) {
    throw redirect({ to: "/account" })
  }
}
