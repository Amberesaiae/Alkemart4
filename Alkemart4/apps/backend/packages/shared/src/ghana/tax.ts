export const GHANA_VAT = {
  vatRate: 0.15,
  nhilRate: 0.025,
  getfundRate: 0.025,
  effectiveRate: 0.20,
} as const

export const TIN_FORMAT = /^\d{13}$/
export const GHANA_CARD_PIN_PATTERN = /^GHA-\d{9}$/

export function calculateTaxInclusive(netPricePesewas: number): {
  net: number
  vat: number
  nhil: number
  getfund: number
  total: number
} {
  const net = netPricePesewas
  const vat = Math.round(net * GHANA_VAT.vatRate)
  const nhil = Math.round(net * GHANA_VAT.nhilRate)
  const getfund = Math.round(net * GHANA_VAT.getfundRate)
  return { net, vat, nhil, getfund, total: net + vat + nhil + getfund }
}

export function calculateTaxExclusive(grossPricePesewas: number): {
  net: number
  vat: number
  nhil: number
  getfund: number
  total: number
} {
  const net = Math.round(grossPricePesewas / (1 + GHANA_VAT.effectiveRate))
  const vat = Math.round(net * GHANA_VAT.vatRate)
  const nhil = Math.round(net * GHANA_VAT.nhilRate)
  const getfund = grossPricePesewas - net - vat - nhil
  return { net, vat, nhil, getfund, total: net + vat + nhil + getfund }
}
