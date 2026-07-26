import type { Hook, ReturnWorkflow } from "@medusajs/framework/workflows-sdk"
import type { AdditionalData, ProductTypes } from "@medusajs/framework/types"
import type { CreateProductDTO } from "@mercurjs/types"

type CreateProductsWorkflowInput = {
  products: (CreateProductDTO & { seller_ids?: string[] })[]
  created_by: string
} & AdditionalData

type CreateProductsWorkflowHooks = [
  Hook<"validate", { input: CreateProductsWorkflowInput; products?: (CreateProductDTO & { seller_ids?: string[] })[] }, unknown>,
  Hook<"productsCreated", { products: ProductTypes.ProductDTO[]; additional_data?: Record<string, unknown>; input?: CreateProductsWorkflowInput }, unknown>,
]

declare module "@mercurjs/core/workflows" {
  export const createProductsWorkflow: ReturnWorkflow<
    CreateProductsWorkflowInput,
    ProductTypes.ProductDTO[],
    CreateProductsWorkflowHooks
  >
}
