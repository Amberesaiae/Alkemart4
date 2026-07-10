import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusIcon, ChevronLeftIcon } from "@radix-ui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { AddressCard } from "@/components/shop/address-card";
import { AddressForm, type AddressFormValues } from "@/components/shop/address-form";
import {
  useListMyAddresses,
  useCreateMyAddress,
  useUpdateMyAddress,
  useDeleteMyAddress,
  getListMyAddressesQueryKey,
  type Address,
} from "@workspace/api-client-react";

export const Route = createFileRoute("/_shop/account/addresses")({
  head: () => ({
    meta: [
      { title: "Addresses — alkemart Ghana" },
      { name: "description", content: "Manage delivery addresses across Accra, Kumasi, Takoradi and beyond." },
      { property: "og:title", content: "Addresses — alkemart Ghana" },
      { property: "og:description", content: "Manage where alkemart delivers." },
      { property: "og:url", content: "/account/addresses" },
    ],
    links: [{ rel: "canonical", href: "/account/addresses" }],
  }),
  component: AddressesPage,
});

function AddressesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListMyAddresses();
  const addresses = data?.items ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Address | undefined>(undefined);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListMyAddressesQueryKey() });

  const createAddress = useCreateMyAddress({ mutation: { onSuccess: () => { invalidate(); setFormOpen(false); } } });
  const updateAddress = useUpdateMyAddress({ mutation: { onSuccess: () => { invalidate(); setFormOpen(false); } } });
  const deleteAddress = useDeleteMyAddress({ mutation: { onSuccess: invalidate } });

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(address: Address) {
    setEditing(address);
    setFormOpen(true);
  }

  function handleSubmit(values: AddressFormValues) {
    if (editing) {
      updateAddress.mutate({ id: editing.id, data: values });
    } else {
      createAddress.mutate({ data: values });
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10">
      <Link to="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon /> Back to account
      </Link>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Addresses</h1>
          <p className="mt-1 text-muted-foreground">Where alkemart delivers. Default address is used for pickup and delivery ETAs.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <PlusIcon /> Add address
        </button>
      </header>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading addresses…</p>
      ) : addresses.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          You haven't saved a delivery address yet. Add one to check out faster.
        </p>
      ) : (
        <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {addresses.map((a) => (
            <AddressCard
              key={a.id}
              name={a.label ? `${a.fullName} — ${a.label}` : a.fullName}
              line1={a.line1}
              city={a.city}
              region={a.region ?? undefined}
              digitalAddress={a.digitalAddress ?? undefined}
              phone={a.phone}
              isDefault={a.isDefault}
              onEdit={() => openEdit(a)}
              onRemove={() => deleteAddress.mutate({ id: a.id })}
            />
          ))}
        </section>
      )}

      <AddressForm
        open={formOpen}
        onOpenChange={setFormOpen}
        address={editing}
        isSaving={createAddress.isPending || updateAddress.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
