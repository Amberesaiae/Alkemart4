import { ImageSlot } from "./image-slot";

export function ExpressDeliveryBand() {
  return (
    <div className="grid items-stretch gap-0 overflow-hidden rounded-2xl bg-primary text-primary-foreground md:grid-cols-[minmax(260px,320px)_1fr_minmax(260px,320px)]">
      <div className="flex items-center justify-center bg-background p-8">
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-accent-foreground" aria-hidden="true">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
          </div>
          <div className="mt-3 font-display text-3xl font-bold text-primary">
            Express
            <br />
            Delivery
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <h2 className="font-display text-3xl font-bold md:text-4xl">
          Delivery as soon as 1 hour*
        </h2>
        <p className="text-sm opacity-90">Shop your faves, fast!</p>
      </div>
      <div className="bg-accent p-6">
        <ImageSlot ratio={4 / 3} rounded="xl" tone="accent" />
      </div>
    </div>
  );
}
