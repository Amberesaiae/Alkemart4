/**
 * Hand-written helpers. Change-password was Express-only — fail honestly.
 */
import { useMutation } from "@tanstack/react-query"

/** Change password — not ported to Medusa customer auth yet. */
export function useChangeMyPassword() {
  return useMutation({
    mutationFn: async (_data: {
      currentPassword: string
      newPassword: string
    }) => {
      throw new Error(
        "Password change is not available on the marketplace API yet. Contact support@alkemart.local.",
      )
    },
  })
}
