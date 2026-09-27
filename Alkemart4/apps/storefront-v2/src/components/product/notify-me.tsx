import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Notification01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useSession } from "@/hooks/use-store"
import { createSubscription } from "@/lib/notifications"

/**
 * Restock alert for signed-in buyers. The contact comes from their account;
 * one-shot (firing deletes it).
 */
export function NotifyMe({ productId, offerId, path }: { productId: string; offerId: string | null; path: string }) {
  const session = useSession()
  const [done, setDone] = useState(false)
  const sub = useMutation({
    mutationFn: () => createSubscription({ productId, offerId, kind: "back_in_stock" }),
    onSuccess: () => {
      setDone(true)
      toast.success("We'll let you know when it's back")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save the alert"),
  })
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-background">
          <HugeiconsIcon icon={Notification01Icon} className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Out of stock right now</p>
          <p className="text-xs text-muted-foreground">Get one message when a seller restocks.</p>
        </div>
      </div>
      {session.data ? (
        <Button variant="outline" disabled={done || sub.isPending} onClick={() => sub.mutate()}>
          {done ? "Alert set" : "Notify me"}
        </Button>
      ) : (
        <Button asChild variant="outline">
          <Link to="/login" search={{ redirect: path }}>
            Sign in to get alerts
          </Link>
        </Button>
      )}
    </div>
  )
}
