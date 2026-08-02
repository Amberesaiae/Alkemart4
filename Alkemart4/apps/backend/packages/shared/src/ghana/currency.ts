export const GHS = {
  code: "GHS" as const,
  name: "Ghanaian Cedi",
  symbol: "GH₵",
  minorUnit: 100,
  locale: "en-GH",
  denominations: {
    notes: [1, 2, 5, 10, 20, 50, 100, 200],
    coins: [0.01, 0.05, 0.10, 0.20, 0.50, 1, 2],
  },
} as const

export function formatGHS(pesewas: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(pesewas / 100)
}

export function pesewasToMajor(pesewas: number): number {
  return pesewas / 100
}

export function majorToPesewas(major: number): number {
  return Math.round(major * 100)
}
