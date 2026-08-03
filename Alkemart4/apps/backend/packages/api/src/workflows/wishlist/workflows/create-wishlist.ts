import {
  WorkflowResponse,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk";

import { CreateWishlistDTO } from "../../../modules/wishlist/index.ts";
import { createWishlistEntryStep } from "../steps/create-wishlist.ts";

export const createWishlistEntryWorkflow = createWorkflow(
  {
    name: "create-wishlist",
  },
  function (input: CreateWishlistDTO) {
    return new WorkflowResponse(createWishlistEntryStep(input));
  }
);
