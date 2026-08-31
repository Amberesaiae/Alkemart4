export type Pesewas = bigint & { readonly __brand: "Pesewas" }

export function asPesewas(n: number | bigint): Pesewas {
  if (typeof n === "number") {
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new Error("pesewas must be a non-negative integer")
    }
    return BigInt(n) as Pesewas
  }
  if (n < 0n) throw new Error("pesewas must be a non-negative integer")
  return n as Pesewas
}
