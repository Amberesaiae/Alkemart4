/** Homepage editor — mirrors apps/api/src/routes/admin/homepage.ts. */
import type { HomeSection, HomepageDocument } from "@alkemart/shared/homepage"
import { api } from "./http"

export const getHomepage = () => api<HomepageDocument>("/admin/homepage")
export const saveHomepageDraft = (revision: number, sections: HomeSection[]) =>
  api<HomepageDocument>("/admin/homepage/draft", { method: "PUT", json: { revision, sections } })
export const publishHomepage = (revision: number) => api<HomepageDocument>("/admin/homepage/publish", { method: "POST", json: { revision } })
export const scheduleHomepage = (revision: number, publishAt: string) =>
  api<HomepageDocument>("/admin/homepage/schedule", { method: "POST", json: { revision, publishAt } })
export const mintHomepagePreview = () => api<{ token: string; expiresInSeconds: number }>("/admin/homepage/preview-token", { method: "POST" })
