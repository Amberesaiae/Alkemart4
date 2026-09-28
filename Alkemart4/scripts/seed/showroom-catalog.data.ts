/**
 * Showroom catalogue content (2026-09-28, owner-approved lineup).
 * Shop names are business names; location lives in the address fields.
 * Every offer is created out of stock: the site is a showroom until real
 * sellers stock their own listings. Photo keys map to
 * showroom-catalog.images.json (already uploaded to R2).
 */

export type ShowroomShop = {
  /** Current handle in the database (the row that is renamed/updated). */
  fromHandle: string | null
  handle: string
  name: string
  description: string
  region: string
  district: string
  city: string
  lat: number
  lng: number
  deliveryFeeGhs: number
  /** false: clear the old cover (it no longer matches the shop). */
  keepBanner: boolean
}

export type ShowroomProduct = {
  shop: string
  /** Existing product title to update in place (Hurry Ventures only). */
  existingTitle?: string
  title: string
  category: string
  ghs?: number
  photos: string[]
  brand?: string
  productType: string
  description: string
  attributes: [string, string][]
}

export type ShowroomCategory = { handle: string; name: string; parent: string | null }

export const CATEGORIES: ShowroomCategory[] = [
  { handle: "furniture", name: "Furniture", parent: "home-living" },
  { handle: "kitchen-dining", name: "Kitchen & Dining", parent: "home-living" },
  { handle: "home-appliances", name: "Home Appliances", parent: "home-living" },
  { handle: "decor-lighting", name: "Décor & Lighting", parent: "home-living" },
  { handle: "storage-organisation", name: "Storage & Organisation", parent: "home-living" },
  { handle: "gifts-crafts", name: "Gifts & Crafts", parent: "home-living" },
  { handle: "fabrics", name: "Fabrics", parent: "fashion-apparel" },
  { handle: "caps-hats", name: "Caps & Hats", parent: "fashion-apparel" },
  { handle: "tools-hardware", name: "Tools & Hardware", parent: null },
  { handle: "power-tools", name: "Power Tools", parent: "tools-hardware" },
  { handle: "hand-tools", name: "Hand Tools", parent: "tools-hardware" },
  { handle: "safety-workwear", name: "Safety & Workwear", parent: "tools-hardware" },
]

export const SHOPS: ShowroomShop[] = [
  {
    fromHandle: "hurry-ventures", handle: "hurry-ventures", name: "Hurry Ventures",
    description: "Leather goods made to last: jackets, satchels, slides and sandals, plus handwoven Bolga bags finished in leather. Every piece is checked by hand before it leaves the shop in Accra.",
    region: "GH07", district: "Accra Metropolitan", city: "Accra", lat: 5.57056, lng: -0.196608, deliveryFeeGhs: 0, keepBanner: true,
  },
  {
    fromHandle: "demo-kumasi-fabrics", handle: "adwoa-prints", name: "Adwoa Prints & Collections",
    description: "African prints for everyday style: wax print by the 6 yards, mudcloth-print trousers, linen shirts and woven caps. Based at Kejetia, Kumasi, sewing and sourcing from local weavers and tailors.",
    region: "GH02", district: "Kumasi Metropolitan", city: "Kejetia, Kumasi", lat: 6.6960, lng: -1.6244, deliveryFeeGhs: 25, keepBanner: true,
  },
  {
    fromHandle: "demo-takoradi-home", handle: "nhyira-home-essentials", name: "Nhyira Home Essentials",
    description: "Everything the kitchen and home needs: non-stick pans, stainless cookware, dinner sets, storage baskets and cooler boxes for outings and events. Trusted household brands at Makola prices.",
    region: "GH07", district: "Accra Metropolitan", city: "Makola, Accra", lat: 5.5489, lng: -0.2105, deliveryFeeGhs: 20, keepBanner: true,
  },
  {
    fromHandle: "demo-osu-electronics", handle: "sika-electro-ventures", name: "Sika Electro Ventures",
    description: "Home and kitchen appliances: blenders, air fryers, gas cookers, water dispensers and washing machines. New, boxed units with setup advice so you buy the right size for your home.",
    region: "GH07", district: "Accra Metropolitan", city: "Kwame Nkrumah Circle, Accra", lat: 5.5700, lng: -0.2150, deliveryFeeGhs: 40, keepBanner: false,
  },
  {
    fromHandle: "demo-tamale-grocers", handle: "ebenezer-furniture-works", name: "Ebenezer Furniture Works",
    description: "Sofas, sectionals and rugs for living rooms and offices. Solid frames, soft-touch fabrics and delivery with setup across Tema and Accra.",
    region: "GH07", district: "Tema Metropolitan", city: "Community 1, Tema", lat: 5.6698, lng: -0.0166, deliveryFeeGhs: 150, keepBanner: false,
  },
  {
    fromHandle: "seller-b", handle: "adom-decor-studio", name: "Adom Décor Studio",
    description: "Lighting, wall pieces and small gifts that give a room character: statement lamps, wine racks, Bolga fans and handmade crochet pieces.",
    region: "GH07", district: "Ayawaso West", city: "East Legon, Accra", lat: 5.6358, lng: -0.1617, deliveryFeeGhs: 30, keepBanner: false,
  },
  {
    fromHandle: null, handle: "kwaku-boateng-tools", name: "Kwaku Boateng Tools Enterprise",
    description: "Tools and safety gear for artisans, electricians and site work: cordless drill kits, insulated electrician's tools, ear defenders, hi-vis vests and reflective workwear.",
    region: "GH07", district: "Ablekuma Central", city: "Abossey Okai, Accra", lat: 5.5530, lng: -0.2270, deliveryFeeGhs: 30, keepBanner: false,
  },
]

export const PRODUCTS: ShowroomProduct[] = [
  // ── Hurry Ventures (leather) ─────────────────────────────────────────
  {
    shop: "hurry-ventures", existingTitle: "Leather Jacket", title: "Leather Jacket", category: "men", photos: [], productType: "Jacket",
    description: "A classic jacket in soft genuine leather, right for harmattan mornings and evenings out. The leather softens and shapes to you with wear.",
    attributes: [["Material", "Genuine leather"], ["Care", "Wipe clean; condition twice a year"]],
  },
  {
    shop: "hurry-ventures", existingTitle: "Leather Sandals", title: "Leather Sandals", category: "shoes", photos: ["leather-sandals"], productType: "Sandals",
    description: "Hand-cut leather cross-strap sandals on a firm, flat sole. The straps soften with wear for an easy all-day fit. Available in tan, brown and black.",
    attributes: [["Material", "Genuine leather"], ["Colours", "Tan, brown, black"], ["Sizes", "EU 38–46"], ["Made in", "Ghana"]],
  },
  {
    shop: "hurry-ventures", title: "Vintage Leather Satchel", category: "bags", ghs: 650, photos: ["vintage-leather-satchel"], productType: "Satchel",
    description: "A roomy satchel in full-grain leather with buckle straps and an adjustable shoulder strap. Fits a 14-inch laptop, notebooks and a water bottle. Each bag ages to its own colour.",
    attributes: [["Material", "Full-grain leather"], ["Fits", "Up to 14\" laptop"], ["Strap", "Adjustable shoulder strap"], ["Colours", "Tan, brown"]],
  },
  {
    shop: "hurry-ventures", title: "Ankara Cross-Strap Slides", category: "shoes", ghs: 220, photos: ["ankara-strap-slides"], productType: "Slides",
    description: "Comfortable slides with crossed Ankara-print straps on a cushioned leather-look sole. A bright, easy pair for weekends, beach days and casual Fridays.",
    attributes: [["Upper", "Ankara wax print"], ["Sole", "Cushioned footbed"], ["Sizes", "EU 37–45"]],
  },
  {
    shop: "hurry-ventures", title: "Bolga Woven Crossbody Bag with Leather Trim", category: "bags", ghs: 350, photos: ["bolga-leather-crossbody"], productType: "Crossbody bag",
    description: "Handwoven Bolgatanga straw on a sturdy leather frame, with a leather flap and a long leather strap. Every bag is woven by hand in the Upper East, so patterns vary slightly.",
    attributes: [["Material", "Elephant grass straw, leather"], ["Strap", "Long leather crossbody strap"], ["Made in", "Bolgatanga, Ghana"]],
  },

  // ── Adwoa Prints & Collections (African fashion) ─────────────────────
  {
    shop: "adwoa-prints", title: "Mudcloth-Print Palazzo Trousers", category: "women", ghs: 280, photos: ["mudcloth-palazzo"], productType: "Trousers",
    description: "Wide-leg palazzo trousers in 100% cotton with a bold mudcloth-inspired print. An elastic waist and a flowing cut keep them cool and comfortable in the heat.",
    attributes: [["Material", "100% cotton"], ["Waist", "Elasticated"], ["Sizes", "S–XXL"], ["Care", "Hand wash cold"], ["Made in", "Ghana"]],
  },
  {
    shop: "adwoa-prints", title: "Tribal-Print Linen Shirt", category: "men", ghs: 320, photos: ["tribal-linen-shirt"], productType: "Shirt",
    description: "A short-sleeve linen-blend shirt with a mandarin collar, a tribal-print front panel and a matching chest pocket. Breathable for Accra afternoons, smart enough for Friday wear.",
    attributes: [["Material", "Linen blend"], ["Collar", "Mandarin"], ["Sizes", "M–XXXL"]],
  },
  {
    shop: "adwoa-prints", title: "Kente-Weave Baseball Cap", category: "caps-hats", ghs: 150, photos: ["kente-cap"], productType: "Cap",
    description: "A six-panel baseball cap made from strip-woven kente-style cloth, with an adjustable back strap. Each cap's stripes differ slightly because the cloth is woven by hand.",
    attributes: [["Material", "Handwoven cotton strip cloth"], ["Fit", "Adjustable, one size"], ["Made in", "Ghana"]],
  },
  {
    shop: "adwoa-prints", title: "Ankara Fila Cap", category: "caps-hats", ghs: 120, photos: ["ankara-fila"], productType: "Cap",
    description: "A soft, structured fila cap in vivid Ankara print, lined for comfort. Pairs well with kaftans and agbada for weddings, church and naming ceremonies.",
    attributes: [["Material", "Cotton wax print, lined"], ["Sizes", "56–60 cm"], ["Made in", "Ghana"]],
  },
  {
    shop: "adwoa-prints", title: "African Wax Print Fabric, 6 Yards", category: "fabrics", ghs: 450, photos: ["wax-print"], productType: "Fabric",
    description: "Six yards of 100% cotton wax print, enough for a kaba and slit or a man's two-piece. Colourfast and ready for your seamstress. Ask the seller for the current patterns in stock.",
    attributes: [["Material", "100% cotton wax print"], ["Length", "6 yards"], ["Width", "About 46 inches"]],
  },

  // ── Nhyira Home Essentials (kitchen & home) ───────────────────────────
  {
    shop: "nhyira-home-essentials", title: "Non-Stick Frying Pan, 28 cm", category: "kitchen-dining", ghs: 350, photos: ["frying-pan"], productType: "Frying pan",
    description: "A 28 cm non-stick frying pan for eggs, plantain and stir-fries with little oil. Works on gas and electric hobs, with a cool-touch handle. Ask the seller about brands currently in stock.",
    attributes: [["Size", "28 cm"], ["Coating", "Non-stick"], ["Hobs", "Gas and electric"]],
  },
  {
    shop: "nhyira-home-essentials", title: "Stainless Steel Cookware Set, 12 Pieces", category: "kitchen-dining", ghs: 1200, photos: ["stainless-cookware"], productType: "Cookware set",
    description: "Pots, a saucepan and colanders in food-grade stainless steel, with glass lids. They won't rust or hold smells, and are big enough for family soups and stews.",
    attributes: [["Pieces", "12"], ["Material", "Stainless steel, glass lids"], ["Hobs", "Gas and electric"]],
  },
  {
    shop: "nhyira-home-essentials", title: "Blue and White Ceramic Dinner Set", category: "kitchen-dining", ghs: 1100, photos: ["ceramic-dinner-set"], productType: "Dinner set",
    description: "Hand-painted blue-and-white ceramic plates, bowls and cups for six. Microwave and dishwasher safe, and pretty enough for guests and festive meals.",
    attributes: [["Serves", "6"], ["Material", "Ceramic"], ["Safe for", "Microwave, dishwasher"]],
  },
  {
    shop: "nhyira-home-essentials", title: "Plastic Storage Basket Set, 3 Pieces", category: "storage-organisation", ghs: 150, photos: ["storage-baskets"], productType: "Storage baskets",
    description: "Three nesting baskets in sturdy plastic with carry handles, for kitchen cabinets, bathrooms and wardrobes. Available in pastel colours.",
    attributes: [["Pieces", "3 sizes"], ["Material", "BPA-free plastic"], ["Colours", "Assorted pastels"]],
  },
  {
    shop: "nhyira-home-essentials", title: "Insulated Cooler Box, 45 L", category: "kitchen-dining", ghs: 550, photos: ["cooler-box"], productType: "Cooler box",
    description: "A 45-litre insulated cooler that keeps drinks and food cold for hours, for parties, funerals, outings and market days. Lockable lid and a strong carry handle.",
    attributes: [["Capacity", "45 litres"], ["Colours", "Blue, orange, purple"], ["Lid", "Lockable"]],
  },

  // ── Sika Electro Ventures (appliances) ────────────────────────────────
  {
    shop: "sika-electro-ventures", title: "Silver Crest 2-in-1 Blender, 2 L", category: "home-appliances", ghs: 450, brand: "Silver Crest", photos: ["blender"], productType: "Blender",
    description: "A powerful 2-litre blender with a grinding mill, for smoothies, pepper, tomatoes and dried ingredients. Stainless steel blades and speed control.",
    attributes: [["Capacity", "2 L jug plus mill"], ["Power", "High-power motor"], ["Plug", "UK 3-pin"]],
  },
  {
    shop: "sika-electro-ventures", title: "Digital Air Fryer, 6 L", category: "home-appliances", ghs: 1300, photos: ["air-fryer"], productType: "Air fryer",
    description: "Crispy chips, chicken and kelewele with little or no oil. A 6-litre basket, touch controls and preset programmes. Available in several colours.",
    attributes: [["Capacity", "6 litres"], ["Controls", "Digital touch"], ["Plug", "UK 3-pin"]],
  },
  {
    shop: "sika-electro-ventures", title: "5-Burner Glass Gas Hob with Electric Plate", category: "home-appliances", ghs: 3800, photos: ["gas-hob"], productType: "Gas hob",
    description: "A built-in tempered-glass hob with four gas burners, a large centre burner and one electric plate, so you can keep cooking when gas runs out. Cast-iron pan supports and auto-ignition.",
    attributes: [["Burners", "4 gas + 1 electric"], ["Top", "Tempered glass"], ["Ignition", "Automatic"]],
  },
  {
    shop: "sika-electro-ventures", title: "Hot and Cold Water Dispenser", category: "home-appliances", ghs: 2500, photos: ["water-dispenser"], productType: "Water dispenser",
    description: "A floor-standing dispenser for hot and cold water, top-loading for standard bottles, with a child lock on the hot tap and a storage cabinet below.",
    attributes: [["Taps", "Hot and cold"], ["Safety", "Child lock on hot tap"], ["Loading", "Top-load bottle"]],
  },
  {
    shop: "sika-electro-ventures", title: "Samsung Front-Load Washing Machine", category: "home-appliances", ghs: 11500, brand: "Samsung", photos: ["washer"], productType: "Washing machine",
    description: "A large-capacity Samsung front-load washer with a digital panel, quick-wash cycles and gentle care for fabrics. Energy-efficient for large families.",
    attributes: [["Type", "Front load"], ["Capacity", "Extra large"], ["Warranty", "Manufacturer warranty; ask the seller"]],
  },

  // ── Ebenezer Furniture Works (furniture) ─────────────────────────────
  {
    shop: "ebenezer-furniture-works", title: "3-Seater Sofa with Matching Footrest, Brown", category: "furniture", ghs: 8500, photos: ["brown-sofa"], productType: "Sofa",
    description: "A channel-tufted three-seater sofa in soft brown velvet-touch fabric, with a matching footrest. Solid wood frame and high-density foam. For living rooms, offices and bedrooms.",
    attributes: [["Seats", "3"], ["Fabric", "Velvet-touch"], ["Includes", "Footrest"], ["Frame", "Solid wood"]],
  },
  {
    shop: "ebenezer-furniture-works", title: "Grey Modular Sectional Sofa", category: "furniture", ghs: 14500, photos: ["grey-sectional"], productType: "Sectional sofa",
    description: "A deep, modular sectional in textured grey fabric that seats the whole family. The sections rearrange to fit your room. Delivered and set up by our team.",
    attributes: [["Seats", "6+"], ["Fabric", "Textured grey"], ["Layout", "Modular"]],
  },
  {
    shop: "ebenezer-furniture-works", title: "L-Shaped Sofa with Chaise, Grey", category: "furniture", ghs: 12000, photos: ["l-sofa"], productType: "L-shaped sofa",
    description: "An L-shaped sofa with a wide chaise and loose back cushions, in hard-wearing grey fabric. The chaise can be set to the left or the right.",
    attributes: [["Seats", "5"], ["Fabric", "Grey woven"], ["Chaise", "Left or right"]],
  },
  {
    shop: "ebenezer-furniture-works", title: "Shaggy Area Rug, 160 × 230 cm", category: "furniture", ghs: 900, photos: ["shaggy-rugs"], productType: "Rug",
    description: "A thick, soft shaggy rug in plain and patterned designs to warm up tiled floors. Anti-slip backing. Choose from grey, cream, red, brown and black-and-white.",
    attributes: [["Size", "160 × 230 cm"], ["Pile", "Shaggy"], ["Backing", "Anti-slip"]],
  },

  // ── Adom Décor Studio (décor & gifts) ─────────────────────────────────
  {
    shop: "adom-decor-studio", title: "Sunset Pendant Light", category: "decor-lighting", ghs: 650, photos: ["pendant-light", "pendant-light-2"], productType: "Pendant light",
    description: "A dome pendant with layered orange rings that glows like a sunset when lit. Adds warmth over dining tables, bars and reading corners. Bulb not included.",
    attributes: [["Colour", "Orange"], ["Fitting", "E27"], ["Cable", "Adjustable drop"]],
  },
  {
    shop: "adom-decor-studio", title: "Teapot Wall Lamp", category: "decor-lighting", ghs: 380, photos: ["teapot-lamp"], productType: "Wall lamp",
    description: "A metal teapot upcycled into a wall lamp, with a vintage filament bulb hanging from the spout. A conversation piece for kitchens, cafés and chop bars.",
    attributes: [["Material", "Aluminium teapot"], ["Bulb", "Vintage filament included"], ["Mount", "Wall"]],
  },
  {
    shop: "adom-decor-studio", title: "Holding the Moon Table Lamp", category: "decor-lighting", ghs: 550, photos: ["moon-lamp"], productType: "Table lamp",
    description: "A sculpted pair of red hands cradling a glowing globe. A striking bedside or shelf lamp that gives off a soft, warm light.",
    attributes: [["Colour", "Red base, white globe"], ["Material", "Resin, glass"], ["Plug", "UK 3-pin"]],
  },
  {
    shop: "adom-decor-studio", title: "Wooden Floating Wine Shelf", category: "decor-lighting", ghs: 450, photos: ["wine-shelf"], productType: "Wine shelf",
    description: "A wall-mounted wooden wine shelf that holds three bottles, with stemware slots underneath. Screws included.",
    attributes: [["Holds", "3 bottles + glasses"], ["Material", "Pine wood"], ["Mount", "Wall"]],
  },
  {
    shop: "adom-decor-studio", title: "Wall Wine Rack with Glass Holder", category: "decor-lighting", ghs: 750, photos: ["wine-rack"], productType: "Wine rack",
    description: "A walnut-finish wall rack for six bottles with a stemware rail for five glasses. Turns a blank wall into a home bar.",
    attributes: [["Holds", "6 bottles, 5 glasses"], ["Finish", "Walnut"], ["Mount", "Wall"]],
  },
  {
    shop: "adom-decor-studio", title: "Bolga Elephant Grass Hand Fans, Set of 2", category: "gifts-crafts", ghs: 180, photos: ["bolga-fans"], productType: "Hand fan",
    description: "Handwoven elephant-grass fans from Bolgatanga with leather-wrapped handles. Beautiful on the wall and handy in the heat.",
    attributes: [["Pieces", "2"], ["Material", "Elephant grass, leather"], ["Made in", "Bolgatanga, Ghana"]],
  },
  {
    shop: "adom-decor-studio", title: "Crochet Animal Remote Holder", category: "gifts-crafts", ghs: 60, photos: ["remote-covers"], productType: "Remote holder",
    description: "Handmade crochet sleeves that keep the TV remote safe and easy to find, in bear, bunny and frog designs. A cute gift for homes with children.",
    attributes: [["Designs", "Bear, bunny, frog"], ["Material", "Cotton yarn"], ["Made", "By hand"]],
  },
  {
    shop: "adom-decor-studio", title: "Gym Weight Keychains, Set of 3", category: "gifts-crafts", ghs: 75, photos: ["gym-keychains"], productType: "Keychain",
    description: "Mini dumbbell, kettlebell and weight-plate keychains, a fun gift for gym lovers and personal trainers.",
    attributes: [["Pieces", "3"], ["Material", "Metal and rubber"]],
  },

  // ── Kwaku Boateng Tools Enterprise (tools & safety) ───────────────────
  {
    shop: "kwaku-boateng-tools", title: "Cordless Drill Tool Kit with Case", category: "power-tools", ghs: 1450, photos: ["drill-kit"], productType: "Tool kit",
    description: "A cordless drill-driver with a rechargeable battery and charger, plus pliers, wrenches, screwdrivers, a hammer, a tape measure and bits, all in a sturdy carry case. Ready for home repairs and artisan work.",
    attributes: [["Drill", "Cordless, rechargeable"], ["Includes", "Hand tools, bits, charger"], ["Case", "Hard carry case"]],
  },
  {
    shop: "kwaku-boateng-tools", title: "Insulated Electrician's Tool Case", category: "hand-tools", ghs: 3200, photos: ["insulated-tools"], productType: "Tool set",
    description: "A professional set of insulated screwdrivers, pliers, cutters and hex keys in a rugged wheeled case, for safe work on live installations.",
    attributes: [["Insulation", "VDE-style, for live work"], ["Case", "Wheeled hard case"], ["Pieces", "30+"]],
  },
  {
    shop: "kwaku-boateng-tools", title: "Reflective Hi-Vis Work Trousers", category: "safety-workwear", ghs: 280, photos: ["hivis-trousers"], productType: "Work trousers",
    description: "Durable cargo work trousers with reflective bands at the shins, for road, site and night work. Reinforced knees and plenty of pockets.",
    attributes: [["Colour", "Navy"], ["Reflective", "Two bands per leg"], ["Sizes", "M–XXXL"]],
  },
  {
    shop: "kwaku-boateng-tools", title: "Site Safety Kit: Ear Defenders and Hi-Vis Vest", category: "safety-workwear", ghs: 420, photos: ["safety-kit"], productType: "Safety kit",
    description: "Padded ear defenders and a hi-vis reflective vest, the basics for construction sites, factories and road works.",
    attributes: [["Includes", "Ear defenders, hi-vis vest"], ["Vest sizes", "L–XXL"]],
  },
]
