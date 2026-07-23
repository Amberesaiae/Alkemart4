/**
 * ============================================================================
 * LEGACY stubs — honest no-ops / errors (Express is not production)
 * ============================================================================
 * Admin/vendor dual-home removed. Remaining exports exist only so optional
 * UI surfaces can fail clearly without a dead /api proxy.
 *
 * Prefer Medusa SDK + store adapters. Do not re-add Express ops hooks.
 * ============================================================================
 */
import { useMutation } from "@tanstack/react-query"

const EXPRESS_GONE =
  "This action is not available on the marketplace API yet. Email support@alkemart.local."

/** @deprecated Express cancel — use support email until Medusa cancel is ported. */
export function useCancelMyOrder() {
  return useMutation({
    mutationFn: async (_orderId: string) => {
      throw new Error(EXPRESS_GONE)
    },
  })
}

/** @deprecated Express disputes — use mailto support. */
export function useCreateMyDispute() {
  return useMutation({
    mutationFn: async (_data: {
      orderId: string
      reason: string
      details?: string
    }) => {
      throw new Error(EXPRESS_GONE)
    },
  })
}

/** @deprecated Password reset not ported — show honest UI. */
export function useForgotPassword(opts?: {
  mutation?: { onSuccess?: () => void; onError?: (err: unknown) => void }
}) {
  return useMutation({
    mutationFn: async (_params: { data: { email: string } }) => {
      throw new Error(
        "Password reset email is not enabled yet. Contact support@alkemart.local.",
      )
    },
    onSuccess: () => opts?.mutation?.onSuccess?.(),
    onError: (err) => opts?.mutation?.onError?.(err),
  })
}

/** @deprecated */
export function useResetPassword(opts?: {
  mutation?: { onSuccess?: () => void; onError?: (err: unknown) => void }
}) {
  return useMutation({
    mutationFn: async (_params: {
      data: { token: string; newPassword?: string; password?: string }
    }) => {
      throw new Error(
        "Password reset is not enabled yet. Contact support@alkemart.local.",
      )
    },
    onSuccess: () => opts?.mutation?.onSuccess?.(),
    onError: (err) => opts?.mutation?.onError?.(err),
  })
}
