/**
 * Ensure store currency GHS + region Ghana (country GH) for alkemart.
 * Safe to re-run.
 *
 *   bunx medusa exec ./src/scripts/ensure-ghana-region.ts
 */
import {
  createRegionsWorkflow,
  createTaxRegionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateStoresStep } from "@medusajs/medusa/core-flows"
import { ExecArgs, Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

const updateStoreCurrencies = createWorkflow(
  "ensure-ghana-store-currencies",
  (input: {
    selector: { id: string }
    update: {
      supported_currencies: { currency_code: string; is_default?: boolean }[]
    }
  }) => {
    const normalized = transform({ input }, (data) => ({
      selector: data.input.selector,
      update: {
        supported_currencies: data.input.update.supported_currencies.map(
          (currency) => ({
            currency_code: currency.currency_code,
            is_default: currency.is_default ?? false,
          }),
        ),
      },
    }))
    return new WorkflowResponse(updateStoresStep(normalized))
  },
)

export default async function ensureGhanaRegion({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const storeModule = container.resolve(Modules.STORE)
  const regionModule = container.resolve(Modules.REGION)
  const taxModule = container.resolve(Modules.TAX)

  const [store] = await storeModule.listStores()
  if (!store) throw new Error("No store found")

  await updateStoreCurrencies(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [{ currency_code: "ghs", is_default: true }],
      },
    },
  })
  logger.info("Store currencies → GHS default")

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { name: "alkemart" },
    },
  })

  const regions = await regionModule.listRegions({}, { relations: ["countries"] })
  const hasGh = regions.some((r) =>
    r.countries?.some((c) => (c.iso_2 || "").toLowerCase() === "gh"),
  )

  if (!hasGh) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Ghana",
            currency_code: "ghs",
            countries: ["gh"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    logger.info(`Created Ghana region ${result[0]?.id}`)
  } else {
    const r = regions.find((x) =>
      x.countries?.some((c) => (c.iso_2 || "").toLowerCase() === "gh"),
    )
    logger.info(`Ghana country already on region ${r?.id} (${r?.name})`)
  }

  const taxRegions = await taxModule.listTaxRegions()
  if (!taxRegions.some((t) => (t.country_code || "").toLowerCase() === "gh")) {
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: "gh", provider_id: "tp_system" }],
    })
    logger.info("Created tax region GH")
  } else {
    logger.info("Tax region GH already exists")
  }

  logger.info(
    "Ghana locale ready: prefer GHS, country GH, Accra/Kumasi addresses, GhanaPostGPS, +233 phones.",
  )
}
