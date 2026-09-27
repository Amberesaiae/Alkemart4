import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitReview } from "@/lib/reviews"
import { cn } from "@/lib/utils"

export function ReviewDialog({ orderId, email, sellerName }: { orderId: string; email: string; sellerName: string }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [done, setDone] = useState(false)
  const send = useMutation({
    mutationFn: () => submitReview({ orderId, buyerEmail: email, rating, title: title.trim() || null, body: body.trim() }),
    onSuccess: () => {
      setDone(true)
      setOpen(false)
      toast.success("Thanks! Your review will appear once it's checked.")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't send your review"),
  })
  if (done) return <p className="text-sm text-success">Review sent — thank you.</p>
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Review this order</Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>How was your order from {sellerName}?</DialogTitle>
          <DialogDescription>Your review helps other buyers choose. It's shown as a verified purchase.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Rating" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(n)}>
                <HugeiconsIcon icon={StarIcon} className={cn("size-8", n <= rating ? "fill-star text-star" : "text-border")} />
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-title">Headline <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="rv-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-body">Your review</Label>
            <Textarea id="rv-body" maxLength={2000} rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you like? Would you buy again?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="brand" disabled={!rating || !body.trim() || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? "Sending…" : "Send review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
