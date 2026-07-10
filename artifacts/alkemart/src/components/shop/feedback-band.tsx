import { Button } from "@/components/ui/button";

export function FeedbackBand() {
  return (
    <section className="border-t border-border/40 bg-secondary/60">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-2 px-4 py-4 text-center">
        <p className="text-sm font-semibold text-secondary-foreground">
          We'd love to hear what you think!
        </p>
        <Button variant="outline" size="lg">
          Give feedback
        </Button>
      </div>
    </section>
  );
}
