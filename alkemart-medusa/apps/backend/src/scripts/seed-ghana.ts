import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

async function seedGhanaData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionModule = container.resolve(Modules.REGION)
  const productModule = container.resolve(Modules.PRODUCT)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)

  logger.info("Seeding Ghana regions, categories, and products...")

  // 1. Create Ghana region with GHS currency
  let region: any
  try {
    const { regions } = await regionModule.listRegions({ name: "Ghana" })
    if (regions && regions.length > 0) {
      region = regions[0]
      logger.info(`Region "Ghana" already exists (id: ${region.id})`)
    } else {
      region = await regionModule.createRegions({
        name: "Ghana",
        currency_code: "ghs",
        countries: ["GH"],
        payment_providers: ["pp_system_default"],
        fulfillment_providers: ["fp_manual"],
        metadata: { timezone: "Africa/Accra" },
      })
      logger.info(`Created region "Ghana" (id: ${region.id})`)
    }
  } catch (err) {
    logger.warn(`Region creation skipped: ${err}`)
  }

  // 2. Create default sales channel
  let salesChannel: any
  try {
    const channels = await salesChannelModule.listSalesChannels({ name: "Alkemart Storefront" })
    if (channels.length > 0) {
      salesChannel = channels[0]
    } else {
      salesChannel = await salesChannelModule.createSalesChannels({
        name: "Alkemart Storefront",
        description: "Default storefront channel",
      })
    }
    logger.info(`Sales channel: ${salesChannel.id}`)
  } catch (err) {
    logger.warn(`Sales channel creation skipped: ${err}`)
  }

  // 3. Create product categories
  const categoryNames = [
    "Electronics",
    "Fashion",
    "Home & Garden",
    "Beauty & Health",
    "Groceries",
    "Phones & Tablets",
    "Fashion - Men",
    "Fashion - Women",
  ]

  const categoryMap: Record<string, any> = {}
  for (const name of categoryNames) {
    try {
      const { product_categories } = await productModule.listProductCategories({ name })
      if (product_categories && product_categories.length > 0) {
        categoryMap[name] = product_categories[0]
        continue
      }
      const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")
      const cat = await productModule.createProductCategories({
        name,
        handle,
        is_active: true,
      })
      categoryMap[name] = cat
      logger.info(`Created category "${name}" (id: ${cat.id})`)
    } catch (err) {
      logger.warn(`Category "${name}" creation skipped: ${err}`)
    }
  }

  // Create subcategories
  try {
    const electronicsParent = categoryMap["Electronics"]
    if (electronicsParent) {
      const { product_categories: existing } = await productModule.listProductCategories({ name: "Smartphones" })
      if (!existing || existing.length === 0) {
        await productModule.createProductCategories({
          name: "Smartphones",
          handle: "smartphones",
          parent_category_id: electronicsParent.id,
          is_active: true,
        })
      }
    }
  } catch {}

  // 4. Create test products
  const testProducts = [
    {
      title: "Samsung Galaxy A15 - Dual SIM 128GB",
      description: "Samsung Galaxy A15 with 6.5-inch Super AMOLED display, 5000mAh battery, and triple camera system. Dual SIM, 128GB storage.",
      handle: "samsung-galaxy-a15-128gb",
      category: "Phones & Tablets",
      priceGhs: 1899.00,
      stock: 45,
      thumbnail: "https://placehold.co/600x600?text=Samsung+Galaxy+A15",
    },
    {
      title: "Infinix Hot 40 Pro - 256GB",
      description: "Infinix Hot 40 Pro with 6.78-inch display, 108MP camera, 5000mAh battery. 256GB storage, 8GB RAM.",
      handle: "infinix-hot-40-pro-256gb",
      category: "Phones & Tablets",
      priceGhs: 1499.00,
      stock: 62,
      thumbnail: "https://placehold.co/600x600?text=Infinix+Hot+40+Pro",
    },
    {
      title: "Hisense 43\" Full HD Smart TV",
      description: "Hisense 43-inch Full HD Smart TV with built-in WiFi, Netflix, YouTube. DLED display technology.",
      handle: "hisense-43-smart-tv",
      category: "Electronics",
      priceGhs: 2999.00,
      stock: 18,
      thumbnail: "https://placehold.co/600x600?text=Hisense+43+Smart+TV",
    },
    {
      title: "HP Laptop 15s - Intel Core i5, 8GB RAM, 512GB SSD",
      description: "HP 15s-fq5000 series laptop with Intel Core i5-1235U, 8GB DDR4 RAM, 512GB NVMe SSD, 15.6-inch FHD display.",
      handle: "hp-laptop-15s-i5-512gb",
      category: "Electronics",
      priceGhs: 5499.00,
      stock: 12,
      thumbnail: "https://placehold.co/600x600?text=HP+Laptop+15s",
    },
    {
      title: "Men's Polo T-Shirt - Cotton Blend",
      description: "Comfortable cotton-blend polo t-shirt for men. Available in multiple colors. Machine washable.",
      handle: "mens-polo-tshirt",
      category: "Fashion - Men",
      priceGhs: 89.00,
      stock: 150,
      thumbnail: "https://placehold.co/600x600?text=Mens+Polo+TShirt",
    },
    {
      title: "Women's Ankara Print Dress",
      description: "Beautiful Ankara print dress with modern cut. Perfect for casual and formal occasions.",
      handle: "womens-ankara-dress",
      category: "Fashion - Women",
      priceGhs: 249.00,
      stock: 35,
      thumbnail: "https://placehold.co/600x600?text=Ankara+Dress",
    },
    {
      title: "Philips Air Fryer - 4.1L",
      description: "Philips Essential Airfryer with Rapid Air technology. 4.1L capacity, digital controls, 7 preset cooking functions.",
      handle: "philips-airfryer-4l",
      category: "Home & Garden",
      priceGhs: 1299.00,
      stock: 22,
      thumbnail: "https://placehold.co/600x600?text=Philips+Airfryer",
    },
    {
      title: "Anker PowerCore 20000mAh Power Bank",
      description: "Anker PowerCore 20000mAh portable charger with dual USB ports, PowerIQ technology. Fast charging for phones and tablets.",
      handle: "anker-powerbank-20000mah",
      category: "Electronics",
      priceGhs: 349.00,
      stock: 80,
      thumbnail: "https://placehold.co/600x600?text=Anker+PowerBank",
    },
    {
      title: "Dettol Antibacterial Soap - 6 Pack",
      description: "Dettol antibacterial bar soap for protection against bacteria. Gentle on skin. 6-pack value bundle.",
      handle: "dettol-soap-6pack",
      category: "Beauty & Health",
      priceGhs: 45.00,
      stock: 200,
      thumbnail: "https://placehold.co/600x600?text=Dettol+Soap+6pk",
    },
    {
      title: "Indomie Instant Noodles - 40 Pack",
      description: "Indomie instant noodles variety pack. 40 packs of delicious quick meals. Multiple flavors included.",
      handle: "indomie-noodles-40pack",
      category: "Groceries",
      priceGhs: 120.00,
      stock: 100,
      thumbnail: "https://placehold.co/600x600?text=Indomie+40+Pack",
    },
    {
      title: "JBL Tune 510BT Wireless Headphones",
      description: "JBL Tune 510BT on-ear wireless headphones with JBL Pure Bass sound, 40-hour battery life, and multipoint connection.",
      handle: "jbl-tune-510bt",
      category: "Electronics",
      priceGhs: 499.00,
      stock: 30,
      thumbnail: "https://placehold.co/600x600?text=JBL+Tune+510BT",
    },
    {
      title: "Xiaomi Redmi Note 13 - 128GB",
      description: "Xiaomi Redmi Note 13 with 6.67-inch AMOLED display, 108MP camera, 5000mAh battery, 33W fast charging.",
      handle: "xiaomi-redmi-note-13-128gb",
      category: "Phones & Tablets",
      priceGhs: 1699.00,
      stock: 55,
      thumbnail: "https://placehold.co/600x600?text=Xiaomi+Redmi+Note+13",
    },
  ]

  for (const p of testProducts) {
    try {
      const { products: existing } = await productModule.listProducts({ title: p.title })
      if (existing && existing.length > 0) {
        logger.info(`Product "${p.title}" already exists, skipping`)
        continue
      }

      const category = categoryMap[p.category]
      const priceInPesewas = Math.round(p.priceGhs * 100)

      const product = await productModule.createProducts({
        title: p.title,
        description: p.description,
        handle: p.handle,
        status: "published",
        images: p.thumbnail ? [{ url: p.thumbnail }] : [],
        options: [{ title: "Size", values: ["Default"] }],
        variants: [
          {
            title: "Default",
            prices: [
              {
                amount: priceInPesewas,
                currency_code: "ghs",
              },
            ],
            options: { Size: "Default" },
            inventory_quantity: p.stock,
          },
        ],
        tags: [],
        metadata: {
          category_handle: p.category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        },
      })

      // Link to category if available
      if (category) {
        try {
          await productModule.batchProductProductCategories([
            { id: product.id, add: [category.id] },
          ])
        } catch {
          // Category linking may fail if already linked
        }
      }

      // Link to sales channel
      if (salesChannel) {
        try {
          await salesChannelModule.createSalesChannelProducts([
            { id: salesChannel.id, add: [product.id] },
          ])
        } catch {
          // Already linked
        }
      }

      logger.info(`Created product "${p.title}" (id: ${product.id}, price: GHS ${p.priceGhs})`)
    } catch (err) {
      logger.warn(`Product "${p.title}" creation failed: ${err}`)
    }
  }

  logger.info("Seed complete!")
}

export default seedGhanaData
