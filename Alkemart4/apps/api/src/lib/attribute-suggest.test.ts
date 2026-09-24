import { describe, expect, it } from "vitest"
import {
  extractJsonObject,
  suggestAttributes,
  validateSuggestions,
} from "./attribute-suggest"
import type { AttributeDefinitionDto } from "../catalog-repository"

const def = (over: Partial<AttributeDefinitionDto>): AttributeDefinitionDto => ({
  id: `d-${over.code}`, code: "x", label: "X", type: "text",
  unitFamily: null, allowedValues: null, filterable: true, searchable: false,
  required: false, variantAxis: false, visibleOnCard: false, visibleOnPdp: true,
  scope: "profile",
  ...over,
})

const DEFS = [
  def({ code: "brand", label: "Brand", type: "option", allowedValues: ["Lenovo", "HP"] }),
  def({ code: "ram_gb", label: "RAM", type: "number" }),
  def({ code: "touchscreen", label: "Touchscreen", type: "boolean" }),
  def({ code: "colour", label: "Colour", type: "text" }),
  def({ code: "ports", label: "Ports", type: "multi_option", allowedValues: ["USB-C", "HDMI"] }),
]

describe("extractJsonObject", () => {
  it("finds the object inside prose or code fences", () => {
    expect(extractJsonObject('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })
  it("returns null for junk, arrays and truncated output", () => {
    expect(extractJsonObject("no json here")).toBeNull()
    expect(extractJsonObject("[1,2]")).toBeNull()
    expect(extractJsonObject('{"a":')).toBeNull()
  })
})

describe("validateSuggestions — model output is untrusted", () => {
  it("keeps values that match their definition", () => {
    expect(
      validateSuggestions(DEFS, {
        brand: "lenovo", ram_gb: "8 GB", touchscreen: "yes",
        colour: "Matte black", ports: ["usb-c", "HDMI"],
      }),
    ).toEqual([
      { definitionId: "d-brand", code: "brand", label: "Brand", optionValues: ["Lenovo"] },
      { definitionId: "d-ram_gb", code: "ram_gb", label: "RAM", numberValue: 8 },
      { definitionId: "d-touchscreen", code: "touchscreen", label: "Touchscreen", booleanValue: true },
      { definitionId: "d-colour", code: "colour", label: "Colour", textValue: "Matte black" },
      { definitionId: "d-ports", code: "ports", label: "Ports", optionValues: ["USB-C", "HDMI"] },
    ])
  })

  it("normalises option casing to the definition's spelling", () => {
    // Otherwise facet values fragment into "Lenovo" and "lenovo".
    const [row] = validateSuggestions(DEFS, { brand: "LENOVO" })
    expect(row.optionValues).toEqual(["Lenovo"])
  })

  it("drops an option value that is not allowed rather than coercing it", () => {
    expect(validateSuggestions(DEFS, { brand: "Dell" })).toEqual([])
  })

  it("drops unknown codes, empty values and unparseable numbers", () => {
    expect(
      validateSuggestions(DEFS, { nope: "x", colour: "", ram_gb: "loads" }),
    ).toEqual([])
  })

  it("takes only the first value for a single-option attribute", () => {
    const [row] = validateSuggestions(DEFS, { brand: ["HP", "Lenovo"] })
    expect(row.optionValues).toEqual(["HP"])
  })
})

describe("suggestAttributes", () => {
  it("returns nothing when there are no definitions, without calling the model", async () => {
    let called = false
    const ai = { run: async () => { called = true; return { response: "{}" } } }
    expect(await suggestAttributes(ai, [], { title: "x" })).toEqual([])
    expect(called).toBe(false)
  })

  it("returns nothing when the model replies with junk", async () => {
    const ai = { run: async () => ({ response: "I cannot help with that." }) }
    expect(await suggestAttributes(ai, DEFS, { title: "Lenovo laptop" })).toEqual([])
  })

  it("validates the model reply rather than trusting it", async () => {
    const ai = {
      run: async () => ({ response: '{"brand":"Lenovo","ram_gb":16,"bogus":"x","touchscreen":"maybe"}' }),
    }
    const out = await suggestAttributes(ai, DEFS, { title: "Lenovo ThinkPad 16GB" })
    expect(out.map((s) => s.code)).toEqual(["brand", "ram_gb"])
  })
})
