export type MegaCategoryItem = {
  label: string
  handle?: string
  searchQuery?: string
  isBrand?: boolean
  isProduct?: boolean
}

export type MegaCategorySection = {
  title: string
  items: MegaCategoryItem[]
}

export type MegaCategoryColumn = {
  sections: MegaCategorySection[]
}

export type MegaDepartmentData = {
  title: string
  columns: MegaCategoryColumn[]
  sections: MegaCategorySection[]
}

export const MEGA_TAXONOMY: Record<string, MegaDepartmentData> = {
  "phones-electronics": {
    title: "Phones & Electronics",
    columns: [
      {
        sections: [
          {
            title: "MOBILE PHONES",
            items: [
              { label: "Smartphones", handle: "phones" },
              { label: "Basic Phones", searchQuery: "Basic phones" },
              { label: "Refurbished Phones", searchQuery: "Refurbished phones" },
            ],
          },
          {
            title: "MOBILE ACCESSORIES",
            items: [
              { label: "Cases & Covers", handle: "accessories" },
              { label: "Screen Protectors", handle: "accessories" },
              { label: "Power Banks & Batteries", handle: "accessories" },
              { label: "Chargers & Cables", handle: "accessories" },
              { label: "Earphones & Headsets", handle: "accessories" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOP PHONE BRANDS",
            items: [
              { label: "Samsung", searchQuery: "Samsung", isBrand: true },
              { label: "Apple", searchQuery: "Apple", isBrand: true },
              { label: "Tecno", searchQuery: "Tecno", isBrand: true },
              { label: "Infinix", searchQuery: "Infinix", isBrand: true },
              { label: "Xiaomi", searchQuery: "Xiaomi", isBrand: true },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOP PRODUCTS",
            items: [
              { label: "iPhone 15", searchQuery: "iPhone 15", isProduct: true },
              { label: "Samsung Galaxy S24", searchQuery: "Samsung Galaxy S24", isProduct: true },
              { label: "Tecno Camon 30", searchQuery: "Tecno Camon 30", isProduct: true },
              { label: "Infinix Note 40", searchQuery: "Infinix Note 40", isProduct: true },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "COMPUTING & AUDIO",
            items: [
              { label: "Laptops & MacBooks", handle: "computing" },
              { label: "External Hard Drives", handle: "computing" },
              { label: "Smart TVs", handle: "tvs-audio" },
              { label: "Bluetooth Speakers", handle: "tvs-audio" },
              { label: "Soundbars", handle: "tvs-audio" },
            ],
          },
        ],
      },
    ],
    sections: [],
  },
  "fashion-apparel": {
    title: "Fashion & Apparel",
    columns: [
      {
        sections: [
          {
            title: "WOMEN'S CLOTHING",
            items: [
              { label: "Traditional & Kente", handle: "women" },
              { label: "Dresses & Gowns", handle: "women" },
              { label: "Tops & Blouses", handle: "women" },
              { label: "Skirts & Trousers", handle: "women" },
              { label: "Lingerie & Nightwear", handle: "women" },
            ],
          },
          {
            title: "MEN'S CLOTHING",
            items: [
              { label: "Traditional Smocks & Agbada", handle: "men" },
              { label: "Shirts & Polos", handle: "men" },
              { label: "Trousers & Chinos", handle: "men" },
              { label: "Jackets & Suits", handle: "men" },
              { label: "Underwear & Socks", handle: "men" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOP FASHION BRANDS",
            items: [
              { label: "Nike", searchQuery: "Nike", isBrand: true },
              { label: "Adidas", searchQuery: "Adidas", isBrand: true },
              { label: "Zara", searchQuery: "Zara", isBrand: true },
              { label: "Puma", searchQuery: "Puma", isBrand: true },
              { label: "Levi's", searchQuery: "Levis", isBrand: true },
              { label: "H&M", searchQuery: "H&M", isBrand: true },
              { label: "Local Artisans", searchQuery: "Artisan fashion", isBrand: true },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "SHOES & FOOTWEAR",
            items: [
              { label: "Men's Formal Shoes", handle: "shoes" },
              { label: "Women's Heels & Flats", handle: "shoes" },
              { label: "Sneakers & Athletic", handle: "shoes" },
              { label: "Sandals & Slippers", handle: "shoes" },
              { label: "Loafers & Boots", handle: "shoes" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "BAGS & ACCESSORIES",
            items: [
              { label: "Women's Handbags", handle: "bags" },
              { label: "Backpacks & Briefcases", handle: "bags" },
              { label: "Wallets & Clutches", handle: "bags" },
              { label: "Belts & Sunglasses", handle: "accessories" },
              { label: "Watches & Jewelry", searchQuery: "watches" },
            ],
          },
        ],
      },
    ],
    sections: [],
  },
  "health-beauty": {
    title: "Health & Beauty",
    columns: [
      {
        sections: [
          {
            title: "SKINCARE & BODY",
            items: [
              { label: "Natural Shea Butter", handle: "skincare" },
              { label: "Facial Care & Serums", handle: "skincare" },
              { label: "Body Lotions & Creams", handle: "skincare" },
              { label: "Sunscreen & SPF", handle: "skincare" },
              { label: "Oral & Dental Care", handle: "cosmetics" },
            ],
          },
          {
            title: "FRAGRANCES",
            items: [
              { label: "Men's Fragrances", handle: "fragrance" },
              { label: "Women's Perfumes", handle: "fragrance" },
              { label: "Body Mists & Sprays", handle: "fragrance" },
              { label: "Antiperspirants & Deodorants", handle: "fragrance" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOP BEAUTY BRANDS",
            items: [
              { label: "CeraVe", searchQuery: "CeraVe", isBrand: true },
              { label: "Nivea", searchQuery: "Nivea", isBrand: true },
              { label: "Maybelline", searchQuery: "Maybelline", isBrand: true },
              { label: "L'Oréal", searchQuery: "L'Oreal", isBrand: true },
              { label: "The Ordinary", searchQuery: "The Ordinary", isBrand: true },
              { label: "Shea Moisture", searchQuery: "Shea Moisture", isBrand: true },
              { label: "Dove", searchQuery: "Dove", isBrand: true },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "MAKEUP & COSMETICS",
            items: [
              { label: "Face Foundations & Powders", handle: "cosmetics" },
              { label: "Lipsticks & Lip Gloss", handle: "cosmetics" },
              { label: "Eye Shadows & Mascara", handle: "cosmetics" },
              { label: "Makeup Brushes & Sponges", handle: "cosmetics" },
              { label: "Setting Sprays", searchQuery: "Setting spray" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "HAIR CARE & WIGS",
            items: [
              { label: "Shampoos & Conditioners", handle: "skincare" },
              { label: "Hair Oils & Treatments", handle: "skincare" },
              { label: "Hair Extensions & Wigs", handle: "skincare" },
              { label: "Hair Dryers & Clippers", searchQuery: "Hair clippers" },
            ],
          },
        ],
      },
    ],
    sections: [],
  },
  "food-groceries": {
    title: "Food & Groceries",
    columns: [
      {
        sections: [
          {
            title: "STAPLES & GRAINS",
            items: [
              { label: "Jasmine & Local Rice", handle: "staples" },
              { label: "Gari & Yam Tubers", handle: "staples" },
              { label: "Beans & Legumes", handle: "staples" },
              { label: "Flour & Bakery Supplies", handle: "staples" },
            ],
          },
          {
            title: "COOKING OILS & SPICES",
            items: [
              { label: "Vegetable & Sunflower Oil", handle: "cooking-oil" },
              { label: "Zomi & Palm Oil", handle: "cooking-oil" },
              { label: "Shito & Hot Sauces", handle: "staples" },
              { label: "Spices, Ginger & Garlic", handle: "staples" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOP PANTRY BRANDS",
            items: [
              { label: "Gino", searchQuery: "Gino", isBrand: true },
              { label: "Royal Aroma", searchQuery: "Royal Aroma", isBrand: true },
              { label: "Frytol", searchQuery: "Frytol", isBrand: true },
              { label: "Tasty Tom", searchQuery: "Tasty Tom", isBrand: true },
              { label: "Milo", searchQuery: "Milo", isBrand: true },
              { label: "Ideal Milk", searchQuery: "Ideal Milk", isBrand: true },
              { label: "Geisha", searchQuery: "Geisha", isBrand: true },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "BREAKFAST & DAIRY",
            items: [
              { label: "Ghanaian Pure Cocoa Powder", handle: "snacks" },
              { label: "Tea & Instant Coffee", handle: "snacks" },
              { label: "Condensed & Evaporated Milk", handle: "snacks" },
              { label: "Oats & Cereals", handle: "snacks" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "SNACKS & CANNED FOOD",
            items: [
              { label: "Plantain Chips & Roasted Nuts", handle: "snacks" },
              { label: "Biscuits & Confectionery", handle: "snacks" },
              { label: "Canned Fish (Sardines/Mackerel)", handle: "snacks" },
              { label: "Tomato Paste & Puree", handle: "cooking-oil" },
            ],
          },
        ],
      },
    ],
    sections: [],
  },
  "home-living": {
    title: "Home & Living",
    columns: [
      {
        sections: [
          {
            title: "KITCHEN & DINING",
            items: [
              { label: "Blenders & Food Processors", handle: "kitchen" },
              { label: "Non-Stick Cookware & Pots", handle: "kitchen" },
              { label: "Food Storage Containers", handle: "storage" },
              { label: "Plates, Bowls & Cutlery", handle: "kitchen" },
            ],
          },
          {
            title: "HOME DECOR",
            items: [
              { label: "Desk & Ceiling Lamps", handle: "decor" },
              { label: "Wall Art & Frames", handle: "decor" },
              { label: "Rugs, Carpets & Mats", handle: "decor" },
              { label: "Curtains & Drapes", handle: "decor" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOP HOME BRANDS",
            items: [
              { label: "Binatone", searchQuery: "Binatone", isBrand: true },
              { label: "Philips", searchQuery: "Philips", isBrand: true },
              { label: "Kenwood", searchQuery: "Kenwood", isBrand: true },
              { label: "Nasco", searchQuery: "Nasco", isBrand: true },
              { label: "Tefal", searchQuery: "Tefal", isBrand: true },
              { label: "IKEA", searchQuery: "IKEA", isBrand: true },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "BEDDING & BATH",
            items: [
              { label: "Bedsheets & Pillowcases", handle: "decor" },
              { label: "Duvets & Comforters", handle: "decor" },
              { label: "Cotton Bath Towels", handle: "decor" },
              { label: "Pillows & Cushions", handle: "decor" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "STORAGE & ORGANIZATION",
            items: [
              { label: "Plastic Storage Tubs", handle: "storage" },
              { label: "Shoe Racks & Shelving", handle: "storage" },
              { label: "Laundry Baskets", handle: "storage" },
              { label: "Hangers & Wardrobe Organizers", handle: "storage" },
            ],
          },
        ],
      },
    ],
    sections: [],
  },
  "baby-kids": {
    title: "Baby & Kids",
    columns: [
      {
        sections: [
          {
            title: "BABY CARE & HYGIENE",
            items: [
              { label: "Diapers & Baby Wipes", handle: "baby" },
              { label: "Baby Lotions & Powders", handle: "baby" },
              { label: "Feeding Bottles & Sterilizers", handle: "baby" },
              { label: "Baby Food & Formula", handle: "baby" },
            ],
          },
          {
            title: "KIDS' FASHION",
            items: [
              { label: "Boys' Shirts & Shorts", handle: "kids" },
              { label: "Girls' Dresses & Skirts", handle: "kids" },
              { label: "Baby Rompers & Onesies", handle: "kids" },
              { label: "Kids' Footwear", handle: "shoes" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOP BABY BRANDS",
            items: [
              { label: "Pampers", searchQuery: "Pampers", isBrand: true },
              { label: "Huggies", searchQuery: "Huggies", isBrand: true },
              { label: "Cussons Baby", searchQuery: "Cussons Baby", isBrand: true },
              { label: "Chicco", searchQuery: "Chicco", isBrand: true },
              { label: "Sebamed", searchQuery: "Sebamed", isBrand: true },
              { label: "Fisher-Price", searchQuery: "Fisher-Price", isBrand: true },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOYS & GAMES",
            items: [
              { label: "Learning & Educational Toys", handle: "baby" },
              { label: "Action Figures & Dolls", handle: "baby" },
              { label: "Board Games & Puzzles", handle: "baby" },
              { label: "Building Blocks", searchQuery: "building blocks" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "NURSERY & GEAR",
            items: [
              { label: "Baby Strollers & Prams", searchQuery: "strollers" },
              { label: "Baby Cots & Cribs", searchQuery: "baby cribs" },
              { label: "Car Seats & Carriers", searchQuery: "car seats" },
              { label: "High Chairs & Boosters", searchQuery: "high chairs" },
            ],
          },
        ],
      },
    ],
    sections: [],
  },
  beverages: {
    title: "Beverages",
    columns: [
      {
        sections: [
          {
            title: "COLD DRINKS",
            items: [
              { label: "Fruit Juices", handle: "beverages" },
              { label: "Soft Drinks & Sodas", handle: "beverages" },
              { label: "Malt & Cereal Drinks", handle: "beverages" },
              { label: "Natural Spring Water", handle: "beverages" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOP BEVERAGE BRANDS",
            items: [
              { label: "Golden Tree", searchQuery: "Golden Tree", isBrand: true },
              { label: "Nestlé", searchQuery: "Nestle", isBrand: true },
              { label: "Coca-Cola", searchQuery: "Coca-Cola", isBrand: true },
              { label: "Bel-Aqua", searchQuery: "Bel-Aqua", isBrand: true },
              { label: "Alvaro", searchQuery: "Alvaro", isBrand: true },
              { label: "Don Simon", searchQuery: "Don Simon", isBrand: true },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "HOT BEVERAGES",
            items: [
              { label: "Golden Tree Chocolate Drinks", handle: "beverages" },
              { label: "Herbal Teas & Infusions", handle: "beverages" },
              { label: "Ground Coffee & Blends", handle: "beverages" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "SYRUPS & MIXERS",
            items: [
              { label: "Flavored Syrups", searchQuery: "syrup" },
              { label: "Sparkling Water", searchQuery: "sparkling water" },
              { label: "Cocktail Mixers", searchQuery: "drink mixer" },
            ],
          },
        ],
      },
    ],
    sections: [],
  },
  "pet-care": {
    title: "Pet Care",
    columns: [
      {
        sections: [
          {
            title: "DOG SUPPLIES",
            items: [
              { label: "Dry & Wet Dog Food", handle: "pet-care" },
              { label: "Dog Treats & Bones", handle: "pet-care" },
              { label: "Collars, Leashes & Harnesses", handle: "pet-care" },
              { label: "Grooming Shampoos & Brushes", handle: "pet-care" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOP PET BRANDS",
            items: [
              { label: "Royal Canin", searchQuery: "Royal Canin", isBrand: true },
              { label: "Pedigree", searchQuery: "Pedigree", isBrand: true },
              { label: "Purina", searchQuery: "Purina", isBrand: true },
              { label: "Whiskas", searchQuery: "Whiskas", isBrand: true },
              { label: "Friskies", searchQuery: "Friskies", isBrand: true },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "CAT SUPPLIES",
            items: [
              { label: "Cat Food & Treats", handle: "pet-care" },
              { label: "Cat Litter & Trays", handle: "pet-care" },
              { label: "Scratching Posts & Toys", handle: "pet-care" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "PET HEALTH & ACCESSORIES",
            items: [
              { label: "Flea & Tick Treatments", searchQuery: "flea tick" },
              { label: "Pet Bowls & Feeders", searchQuery: "pet feeder" },
              { label: "Pet Beds & Blankets", searchQuery: "pet bed" },
            ],
          },
        ],
      },
    ],
    sections: [],
  },
  agriculture: {
    title: "Agriculture",
    columns: [
      {
        sections: [
          {
            title: "FARM INPUTS",
            items: [
              { label: "High-Yield Seeds & Seedlings", handle: "agriculture" },
              { label: "Organic Fertilizers & Compost", handle: "agriculture" },
              { label: "Crop Protection & Sprayers", handle: "agriculture" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOP AGRI BRANDS",
            items: [
              { label: "Wienco", searchQuery: "Wienco", isBrand: true },
              { label: "Agrimat", searchQuery: "Agrimat", isBrand: true },
              { label: "Syngenta", searchQuery: "Syngenta", isBrand: true },
              { label: "Yara", searchQuery: "Yara", isBrand: true },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOOLS & EQUIPMENT",
            items: [
              { label: "Drip Irrigation Kits", handle: "agriculture" },
              { label: "Cutlasses, Hoes & Rakes", handle: "agriculture" },
              { label: "Wheelbarrows & Storage Bags", handle: "agriculture" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "LIVESTOCK SUPPLIES",
            items: [
              { label: "Poultry & Fish Feeds", searchQuery: "animal feed" },
              { label: "Feeders & Drinkers", searchQuery: "livestock feeder" },
              { label: "Veterinary Supplies", searchQuery: "veterinary" },
            ],
          },
        ],
      },
    ],
    sections: [],
  },
  automotive: {
    title: "Automotive",
    columns: [
      {
        sections: [
          {
            title: "CAR CARE & FLUIDS",
            items: [
              { label: "Motor & Synthetic Oils", handle: "automotive" },
              { label: "Brake & Transmission Fluids", handle: "automotive" },
              { label: "Car Wash Shampoos & Waxes", handle: "automotive" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "TOP AUTO BRANDS",
            items: [
              { label: "TotalEnergies", searchQuery: "TotalEnergies", isBrand: true },
              { label: "Shell", searchQuery: "Shell", isBrand: true },
              { label: "Castrol", searchQuery: "Castrol", isBrand: true },
              { label: "Mobil 1", searchQuery: "Mobil 1", isBrand: true },
              { label: "Bosch", searchQuery: "Bosch", isBrand: true },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "ACCESSORIES & TOOLS",
            items: [
              { label: "Phone Mounts & Chargers", handle: "automotive" },
              { label: "Seat Covers & Floor Mats", handle: "automotive" },
              { label: "Emergency Tool Kits & Jacks", handle: "automotive" },
            ],
          },
        ],
      },
      {
        sections: [
          {
            title: "CAR ELECTRONICS",
            items: [
              { label: "Dash Cameras & Sensors", searchQuery: "dash cam" },
              { label: "Bluetooth FM Transmitters", searchQuery: "FM transmitter" },
              { label: "Tire Inflators", searchQuery: "tire inflator" },
            ],
          },
        ],
      },
    ],
    sections: [],
  },
}

// Populate backward-compatible flat sections array for all departments
for (const dept of Object.values(MEGA_TAXONOMY)) {
  dept.sections = dept.columns.flatMap((col) => col.sections)
}
