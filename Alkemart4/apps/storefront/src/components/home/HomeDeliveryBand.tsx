import { MapPin, ShieldCheck, Storefront, Wallet } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  title?: string;
  titleAccent?: string;
  body?: string;
  ctaLabel?: string;
};

/**
 * A deliberately quiet trust strip. It appears after the content-led sections,
 * so the homepage never stacks one large promotional band on another.
 */
export function HomeDeliveryBand({
  className,
  title = "Shopping made clearer",
  titleAccent: _titleAccent,
  body: _body,
  ctaLabel: _ctaLabel,
}: Props) {
  return (
    <section
      className={cn(
        "border-y border-black/[0.09] px-1 py-5 sm:px-2",
        className,
      )}
      aria-labelledby="delivery-band-title"
    >
      <h2 id="delivery-band-title" className="sr-only">
        {title}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AssuranceFact
          icon={<MapPin size={19} weight="duotone" />}
          title="Across Ghana"
          detail="Delivery coverage depends on your location"
        />
        <AssuranceFact
          icon={<Wallet size={19} weight="duotone" />}
          title="Flexible payment"
          detail="Available options are shown at checkout"
        />
        <AssuranceFact
          icon={<ShieldCheck size={19} weight="duotone" />}
          title="Buyer protection"
          detail="Order details are confirmed before checkout"
        />
        <AssuranceFact
          icon={<Storefront size={19} weight="duotone" />}
          title="Independent shops"
          detail="Shop from independent Ghanaian businesses"
        />
      </ul>
    </section>
  );
}

function AssuranceFact({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex min-w-0 items-start gap-2.5 px-1 py-1.5 text-foreground">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/25 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-snug">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {detail}
        </span>
      </span>
    </li>
  );
}
