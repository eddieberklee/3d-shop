/**
 * The shops in the hall. This is the pinned order: index 0 is the first shop on
 * the left, index 1 the first on the right, and so on. At page load,
 * `orderShopsByModels` (`src/shopOrder.ts`) moves the shops with the most
 * generated 3D models to the front; ties keep this order.
 *
 * This list is fixed on purpose, so the same shops stand in the same places on
 * each visit. Only identities are stored here: the shop, and which of its
 * products go on the shelves. Products, prices and
 * images are fetched live from Shop MCP (`src/shop.ts`).
 */
export interface PinnedShop {
  /** `gid://shopify/Shop/{id}`, as Shop MCP returns it in `seller.id`. */
  id: string
  /** The name on the shop front. */
  title: string
  /** The shop's website. */
  url: string
  /** `seller.domain`: the value Shop MCP takes as `shop` for carts and checkouts. */
  domain: string
  /**
   * The products on this shop's shelves: Shop MCP product ids
   * (`gid://shopify/p/{upid}`). Fetch their live data with `lookupCatalog`.
   * Shelf order is by click count (`shelfOrder` in `src/clicks.ts`); this order
   * breaks ties, so with no clicks it is the shelf order.
   */
  products: string[]
}

export const SHOPS: PinnedShop[] = [
  {
    id: "gid://shopify/Shop/3505401",
    title: "Shady Rays",
    url: "https://shadyrays.com",
    domain: "shady-rays.myshopify.com",
    products: [
      "gid://shopify/p/6uToindFRVxrYMPTjnxMPk", // Classic Timber - Amber Woods Polarized
      "gid://shopify/p/3MMsX3urQzhFqgOEwUiTFn", // Cayman - Emerald Smoke Polarized
      "gid://shopify/p/3OCRsVVuXUfJ4gti9qTKZk", // Classic Original - Tortoise Polarized
      "gid://shopify/p/5vrHdK9eYwCxGvBPMnxncm", // Tangle Free Aviator - Rose Gold Polarized
      "gid://shopify/p/2puWlzUjfCIHXVexgzxyaU", // Classic - Marble Tortoise Polarized
      "gid://shopify/p/4NdTNEfkgoffWZUE1r3DAV", // Cayman - Blackout Polarized UNDERCOVER
      "gid://shopify/p/2Kp84oE2X6dXzxi0Hvp3Cu", // Signature Series - Black Glacier Polarized
      "gid://shopify/p/2kvIOFfgN7DjQLEhKMe1uA", // Talon - Emerald Smoke Polarized
      "gid://shopify/p/5aUwL2Fo6g4Pgee2QAwbVC", // Huron Matte Black - Glacier Polarized
      "gid://shopify/p/5K96o3myqMBf828ZQHsmo8", // Navigator - Navy Silver Polarized
    ],
  },
  {
    id: "gid://shopify/Shop/2939277",
    title: "Fashion Nova",
    url: "https://www.fashionnova.com",
    domain: "fnova.myshopify.com",
    products: [
      "gid://shopify/p/6H4F2v0H2kjRXyc22qKkeh", // Nova Season Jumpsuit - Black
      "gid://shopify/p/7m4kPQi3tEK6AZsTnnbGLI", // Maribel Snatched Jumpsuit - Black
      "gid://shopify/p/5jWKa6fVIHUBtHrkTNtUJz", // Gisella Pant Set - Sand/combo
      "gid://shopify/p/30KUHkaYA0tZPpAFiX5EZA", // In My Shadow Jumpsuit - Black
      "gid://shopify/p/6qytDYhf5rgJJFwqjx85S0", // Sofia Snatched Pant Set - Black
      "gid://shopify/p/qxoMrg9T0CT5LpswDW0UZ", // San Diego Sculpting Stretch Flare Jeans - Light Wash
      "gid://shopify/p/4nvIwI1CXWjYjv7oFiyoME", // Juliet Snatched Jumpsuit - Black
      "gid://shopify/p/7t712yFSmbqZY6l4I22LaK", // Hailey Snatched Jumpsuit - Cream
      "gid://shopify/p/52oSul2ilkpBgZxdH1n0YN", // Playing Games Denim Jumpsuit - Denim
      "gid://shopify/p/7LnWqWkcx9jBrwg8fKOcZx", // Carina Snatched Pant Set - Chocolate
    ],
  },
  {
    id: "gid://shopify/Shop/7977215",
    title: "LOOK OPTIC",
    url: "https://www.lookoptic.com",
    domain: "look-optic.myshopify.com",
    products: [
      "gid://shopify/p/7zS0FrMIFEfIx5TEnpWnox", // Muse Progressives
      "gid://shopify/p/78BYxm43njqzO3r5kbpqi7", // Cosmo Progressives
      "gid://shopify/p/4hwOw2HWmKhkTMuU9V5TZg", // Evita Progressives
      "gid://shopify/p/4PaaBkIOwvjfjMVXEpET6k", // Cosmo Readers
      "gid://shopify/p/512tgoxdGdwgvwxEO6G99D", // Laurel Blue Light
      "gid://shopify/p/7IDcTMyeimmStV7zqOqBJr", // No.3 Readers
      "gid://shopify/p/4tSdDPo3ur7OpkDZpAfHIk", // Cooper Progressives
      "gid://shopify/p/hDaLAQZWj4eCB563UjzPs", // No.3 Progressives
      "gid://shopify/p/5R81Y9Bn9ZvxJT0BkmhIUm", // Gina Progressives
      "gid://shopify/p/62jfeLoBDbZ7ITw1zn4j7x", // Linda Readers
    ],
  },
  {
    id: "gid://shopify/Shop/64491782312",
    title: "Fondvue",
    url: "https://www.fondvue.com",
    domain: "6817fd.myshopify.com",
    products: [
      "gid://shopify/p/6THu37oE1cFhITswXPIl5P", // Rimless Ultralight Rectangular Eyeglasses Unisex VK2098
      "gid://shopify/p/4VGvSSK9SPNnB3QZTnFZVZ", // Square Glasses FV101
      "gid://shopify/p/25gOZlZYHIzWjszkRUGHBI", // Fashion Square Blue Light Blocking Glasses & Sunglasses VK23
      "gid://shopify/p/5mWsNiqBkB8VwQTeHAU6al", // Square Fashion Eyeglass Frames Unisex VK2304
      "gid://shopify/p/7AuI4t5q7MMdmzSWc3NfCD", // Oval Glasses VK2023
      "gid://shopify/p/5rKaNyrNBk7JPHT6yLN00k", // Chic Foldable Oval Metal Eyeglass Frames VK2470
      "gid://shopify/p/47XIQ50OaTlu0bCp8R7mCM", // Stylish Square Computer Glasses Anti-Blue Light VK2330
      "gid://shopify/p/5kgsDnkxgzuFgSvzY9rQbQ", // Light Luxury High-Grade Metal Browline Glasses Frame VK2183
      "gid://shopify/p/3TeENjhCYSLKleywwuQFRd", // Bold Cat-Eye Eyeglasses with Textured Temples VK2450
      "gid://shopify/p/7vZehcPAPTOri6hpo5GGCK", // Stylish Rimless Rectangle Glasses VK2521
    ],
  },
  {
    id: "gid://shopify/Shop/28078986",
    title: "DesignerOptics.com",
    url: "https://designeroptics.com",
    domain: "designeroptics-com.myshopify.com",
    products: [
      "gid://shopify/p/arfswgibC3GRlQAnhaysc", // Polo 2115 Eyeglasses
      "gid://shopify/p/vwTWYMoIe2pvdrb7wmEpW", // GENEVIEVE PARIS DESIGN EXCELLENT Eyeglasses
      "gid://shopify/p/2AiEBa4aheAGULb3uGTdad", // SpyOptic RAFE 56 Eyeglasses
      "gid://shopify/p/1ZZqg9ae74FaXdi3KrNJzw", // Guess 1954 Eyeglasses
      "gid://shopify/p/6j8suNSW0ZQvhhV7Vhe542", // Guess 50063 Eyeglasses
      "gid://shopify/p/2oKHCuPaT4Rh9tKvAV91CU", // Genesis 4002 Eyeglasses
      "gid://shopify/p/3zsrYVFnq3Ub2wrBkeMePy", // EXTRA! 101 Eyeglasses
      "gid://shopify/p/3g6pNTf0PB0WRg9X6I4aQN", // MODERN TIMES THESIS Eyeglasses
      "gid://shopify/p/2bbhlsSEdv40NtYJX4HwM2", // MODERN PLASTICS I COSMO Eyeglasses
      "gid://shopify/p/1JhbVSudioWtE8D2OUzwhm", // Boss (hub) 1300 Eyeglasses
    ],
  },
  {
    id: "gid://shopify/Shop/7909597",
    title: "Peepers by PeeperSpecs",
    url: "https://www.peepers.com",
    domain: "beta23.myshopify.com",
    products: [
      "gid://shopify/p/3ICT31h6g2T7KdT0M0mq1K", // Cavern Soft Square Blue Light Reading Glasses for Men
      "gid://shopify/p/3X174emq61VfwcC2bjW4Gn", // Major Square Blue Light Reading Glasses
      "gid://shopify/p/6MYvyHwaSxLU39HQNMWyhJ", // Intermission Round Blue Light Reading Glasses
      "gid://shopify/p/5aZHmZFJJnXXUYaEq1vss8", // Tripp Round Blue Light Reading Glasses for Men
      "gid://shopify/p/7HHjXu48IR4x8IfOa5WZeS", // Siren Rectangle Blue Light Reading Glasses for Women
      "gid://shopify/p/4BbqUUobzccN4ILMisXtxD", // Fable Rectangle Blue Light Reading Glasses for Women
      "gid://shopify/p/xhmacZCdfe1oKIKi5pbyK", // Lucky Stars Rectangle Blue Light Reading Glasses for Women
      "gid://shopify/p/7lmh0rn9wKgoeMeCtWxCM3", // Classified Round Blue Light Reading Glasses for Women
      "gid://shopify/p/4VFUdZbP1zKc6744n8pV4v", // Thorne Soft Square Blue Light Reading Glasses for Men
      "gid://shopify/p/67Ou6wXjwCmljX3KnIdadZ", // Zinnia Soft Square Blue Light Reading Glasses for Women
    ],
  },
  {
    id: "gid://shopify/Shop/1528791092",
    title: "Specsmakers",
    url: "https://www.specsmakers.in",
    domain: "specsmakerspartner.myshopify.com",
    products: [
      "gid://shopify/p/4powDxnUL2qn8SyuXUC2WF", // Full Frame Oval Metal Sunglasses
      "gid://shopify/p/4tyFTiuHdah6LtETN0SG8Z", // Full Frame Geometric Acetate Eyeglasses
      "gid://shopify/p/4wvqT64JNvOPnKfuai0IBU", // Full Frame Round TR90 Eyeglasses
      "gid://shopify/p/6W1nETIYR5pca6cczxuRd8", // Full Frame Oval Metal Sunglasses
      "gid://shopify/p/AyjXQNKoFe1Fcprjhv1AK", // Full Frame Round TR90 Eyeglasses
      "gid://shopify/p/6J1KRdBSmyq10wMHcS0t4A", // Half Frame Rectangle Metal Eyeglasses
      "gid://shopify/p/1ULc5U1JdE5c6fRPIlxu8U", // Half Frame Rectangle Metal Eyeglasses
      "gid://shopify/p/2Rea18fBziFH1p6WgM7K0o", // Half Frame Rectangle Metal Eyeglasses
      "gid://shopify/p/qvWQ1KfTHxQYjavUdpzq6", // Full Frame Rectangle TR90 Eyeglasses
      "gid://shopify/p/1eccIjKAMEk9Oo9vjqQYIA", // Full Frame Round TR90 Eyeglasses
    ],
  },
  {
    id: "gid://shopify/Shop/64853573858",
    title: "lakoh",
    url: "https://www.lakoh.com",
    domain: "nunuglasses.myshopify.com",
    products: [
      "gid://shopify/p/2iNcOpjrjx3WaBWyQYKk9v", // Jennifer
      "gid://shopify/p/2scxDlC8wOMDs9Z7hrYA4X", // Flora
      "gid://shopify/p/4W6Cnl5VOwukHphGIBKNmj", // Stella
      "gid://shopify/p/3nw4QLs1aarwrV0ehOFrjd", // Zircon
      "gid://shopify/p/38ZmGdMWXZrvegSqiyK2Rm", // Vespera
      "gid://shopify/p/4kq4B95LyZ95yPTsQojgpl", // Lucky
      "gid://shopify/p/3fvAYPnetpjWfUkBHhlwjR", // Aura
      "gid://shopify/p/72GRvfvD1c5ewteMqTG0L2", // Mark
      "gid://shopify/p/6ikQx507UIfszjdEnVJsyX", // Victoria
      "gid://shopify/p/3Io7sX6BevowfOR6CPy9s0", // Brett
    ],
  },
  {
    id: "gid://shopify/Shop/1095012",
    title: "ROKA",
    url: "https://www.roka.com",
    domain: "roka.myshopify.com",
    products: [
      "gid://shopify/p/2jNvDFcwMuyvQKSLPgDeVV", // Barton 2.0 Sunglasses
      "gid://shopify/p/1j5bpsasDhcBKWG8hxslaF", // Rory 2.0 Sunglasses
      "gid://shopify/p/oz4lWY08c4jQljJxklZka", // Kona Sunglasses
      "gid://shopify/p/7dIumlf0yqvdIMPEVuE9d6", // Lola OG Sunglasses
      "gid://shopify/p/42Fqcr1lTSPLZH2kybduZl", // CP-1x Sunglasses
      "gid://shopify/p/1qmGCUP4GmFioW4Cygs5EV", // Rory 2.0 Wind Down™ (Non-prescription)
      "gid://shopify/p/6LO6QUJsEsctBinXlOF1v8", // Marfa Sunglasses
      "gid://shopify/p/186EwPrQ4WCezDL4iK3gOZ", // Siena Sunglasses
      "gid://shopify/p/19lIHKTtCUumh7h1e4J5ns", // Oslo 2.0 Sunglasses
      "gid://shopify/p/1Z1dxAAzhjNq0X129VL2Ez", // Small Fit Check Kit
    ],
  },
  {
    id: "gid://shopify/Shop/23041219",
    title: "Psycho Bunny",
    url: "https://www.psychobunny.com",
    domain: "psychobunny-com.myshopify.com",
    products: [
      "gid://shopify/p/2hsc6yE4eqhtxxLMqf6xs4", // MENS CLASSIC CREW NECK TEE - B6U014B200
      "gid://shopify/p/1KUUIDVkemTioZwn63imhY", // MENS CLASSIC PIQUE POLO SHIRT - B6K001CRPC
      "gid://shopify/p/38YWCuTR4HqPVXVAWXWNJP", // MENS SOREN GRAPHIC TEE - MT0200180
      "gid://shopify/p/2Q35J21o2ckVnO8TFTTZci", // MENS CARL GRAPHIC TEE - MT0200251
      "gid://shopify/p/2XfpBhtobLJPTcLAbHRaZY", // MENS ARA GRAPHIC TEE - MT0200250
      "gid://shopify/p/6VhuKCnVmobEfD2M3mfHqG", // MENS EMMANUEL PIMA COTTON GRAPHIC TEE - MT0200353
      "gid://shopify/p/5ERflQ1YkSwhZNX8GCoZUz", // MEN'S SLADE BUNNY GRAPHIC TEE - MT0200452
      "gid://shopify/p/7oAI3QELBR5ZPeaL1DzR17", // MENS KENJI PIMA COTTON GRAPHIC TEE - MT0200415
      "gid://shopify/p/24i5G7f7jn0TXLQs6VomJ2", // MENS JAYDON PIMA PIQUÉ POLO - MT0100239
      "gid://shopify/p/3wT2rGgn6YnlXWa8Dl5jKo", // MENS BYRON GRAPHIC TEE - MT0200416
    ],
  },
  {
    id: "gid://shopify/Shop/22040084552",
    title: "True Classic",
    url: "https://www.trueclassictees.com",
    domain: "trueclassictees-com.myshopify.com",
    products: [
      "gid://shopify/p/7qzMhKA38aqyJdEkkDM9LA", // Black Classic Crew Neck
      "gid://shopify/p/2E2LVi70bpjmWoujec0BLL", // White Classic Crew Neck
      "gid://shopify/p/4vXOC2n9IC3m0OtYpB5MJY", // Navy Classic Crew Neck
      "gid://shopify/p/4zE9ly7vPcXx7W0tusfIWT", // Heather Military Green Classic Crew Neck
      "gid://shopify/p/227cSjyEED4GRuJoDDPtCE", // Black Curved Hem Classic Crew Neck
      "gid://shopify/p/24GpIjPfrBnZLBX6hwxXfo", // Charcoal Heather Gray Classic Crew Neck
      "gid://shopify/p/1b2q2k29gWNRB8jYnCpUFA", // Black Heavyweight Crew
      "gid://shopify/p/5Pxl3axKObvZUNSu7c0v7H", // Heather Navy Classic Crew Neck
      "gid://shopify/p/9pNtTNb7Zch5lR6qzK6hk", // Heather Gray Classic Crew Neck
      "gid://shopify/p/7yU4hRZDqz34kfM6lpeP8g", // White Tall Straight Hem Crew Neck T-Shirt
    ],
  },
  {
    id: "gid://shopify/Shop/69257527484",
    title: "Dickies",
    url: "https://www.dickies.com",
    domain: "dickies-amer.myshopify.com",
    products: [
      "gid://shopify/p/6N5RSAcaFTsKWKWHZs3Alu", // Original 874® Work Pants
      "gid://shopify/p/7yDQF44hnJuryErDRtjI2W", // Loose Fit Double Knee Work Pants
      "gid://shopify/p/2TsWFIVNOaIWag40nCu8Pa", // FLEX Skinny Fit Double Knee Work Pants
      "gid://shopify/p/5OIYwhv1H6JdXg4NSnym4J", // 874® FLEX Work Pants
      "gid://shopify/p/w2ht9FMZWn3F2s4137LoC", // Relaxed Fit Sanded Duck Carpenter Pants
      "gid://shopify/p/5x5rlz5b5L0TQIofsyu85k", // 873 Slim Fit Work Pants
      "gid://shopify/p/74wUVSvCYq7Rx5jnZx3b9d", // Pro Series Double Knee Work Pants
      "gid://shopify/p/68qRpoU8xb102gUCXGYEd", // Loose Fit Cargo Pants
      "gid://shopify/p/3iR6bgQ3kUtprZvsckW4Zm", // Short Sleeve Work Shirt
      "gid://shopify/p/2j12ad6lxoIMBQvCAcvJ7l", // Relaxed Fit Heavyweight Duck Carpenter Pants
    ],
  },
  {
    id: "gid://shopify/Shop/56837701769",
    title: "T.M.Lewin",
    url: "https://tmlewin.co.uk",
    domain: "tmlewinuk.myshopify.com",
    products: [
      "gid://shopify/p/2WUVPJ6r6TH7Vb760ZPtz3", // The Classic T-Shirt
      "gid://shopify/p/7wgUFXaasmcYer9n8Bjuhb", // The Long Sleeve T-Shirt
      "gid://shopify/p/7kWScuZ5rcCy9ydy0JRyHg", // The Non-Iron Poplin Shirt
      "gid://shopify/p/73mID8Cvutv6AAA5cRoZky", // The Non-Iron Oxford Shirt
      "gid://shopify/p/2YDkWXwpq6nYYbqOa8TqDb", // The Non-Iron Twill Shirt
      "gid://shopify/p/5apj0anze5BLE7BJbcrCfj", // The Short Sleeve Henley
      "gid://shopify/p/1P0drCBn7gzjVGTnxX910o", // The Non-Iron Twill Shirt
      "gid://shopify/p/3CrnuhzAmD5fIn9uOMhfyX", // The Classic Stretch T-Shirt
      "gid://shopify/p/IzbOkXSyB5TXYX8hvGfOq", // The Long Sleeve Henley
      "gid://shopify/p/16nEcVEz8aMrPBNCBom6VI", // The Linen Mix Shirt
    ],
  },
  {
    id: "gid://shopify/Shop/6934429751",
    title: "ShopWSS",
    url: "https://www.shopwss.com",
    domain: "shopwss.myshopify.com",
    products: [
      "gid://shopify/p/3xOmtl7zd0vYCJDAX8VCBz", // Air Force 1 Low 07 - Mens
      "gid://shopify/p/34FVPNy8UYT9YKnefMDilZ", // Old Skool - Mens
      "gid://shopify/p/4vGYyQjE4xDZdU6D7fghXY", // Retro 5 - Mens
      "gid://shopify/p/5fgo0Jd16mmzlj4496gIva", // Authentic - Toddler
      "gid://shopify/p/6QzmKgZ2ofOnSO6dklGOUx", // Old Skool - Womens
      "gid://shopify/p/4kKjFlQ91frkoUyNBzejDZ", // Classic Leather - Mens
      "gid://shopify/p/sYREzVekXRPaD8QQzMauJ", // Air Force 1 LE - Youth
      "gid://shopify/p/5ujVlJY8Sw4CLgj23FDOM3", // Campus 00s - Mens
      "gid://shopify/p/1l33OwALy8peVabhU9Cv7l", // Air Force 1 '07 - Womens
      "gid://shopify/p/7d60scqOYzEYLvvQyR9Tci", // Samba Classic - Youth
    ],
  },
  {
    id: "gid://shopify/Shop/1462173742",
    title: "U.S. Polo Assn.",
    url: "https://uspoloassn.com",
    domain: "u-s-polo-assn.myshopify.com",
    products: [
      "gid://shopify/p/3USu3s9Kuzx1DQD2sEB0z7", // SLIM FIT STRETCH SOLID PIQUE POLO SHIRT
      "gid://shopify/p/4j4dlwZrK6Xt1iFYtxttk7", // SOLID PIQUE SMALL LOGO POLO SHIRT
      "gid://shopify/p/7qwC2wVjWoIhQFIwKBvR1B", // LONG SLEEVE WEEKEND OXFORD SHIRT
      "gid://shopify/p/4JFuiL5A54txKpme5ELMO3", // SOLID INTERLOCK POLO SHIRT
      "gid://shopify/p/5g39PbW7T3RowwNjIgFrf0", // SHORT SLEEVE STRETCH OXFORD SHIRT
      "gid://shopify/p/7i7Vq3iyCINtsdYDZ6FLvq", // MULTI COLOR BIG LOGO SOLID POLO SHIRT
      "gid://shopify/p/4dwxAqLIk3elo4Xg2PQeV6", // YARN DYE STRIPE INTERLOCK POLO SHIRT
      "gid://shopify/p/6gdgawrfX3qiQR02IMCZR6", // SLIM FIT BIG LOGO MULTI-TONAL POLO SHIRT
      "gid://shopify/p/Rn2sCfUS1o4nueDLEZo7m", // BIG LOGO SOLID POLO SHIRT
      "gid://shopify/p/5tb1JSfhkny01yNUR5874I", // 4 PACK CREW NECK T-SHIRTS
    ],
  },
  {
    id: "gid://shopify/Shop/14645034",
    title: "BYLT Basics",
    url: "https://byltbasics.com",
    domain: "bylt-apparel.myshopify.com",
    products: [
      "gid://shopify/p/pUDmLMBvUHAPLCXGaQTIw", // Drop-Cut: LUX
      "gid://shopify/p/24zlIsjYoHW5Xqcdvo0Oyt", // Drop-Cut Long Sleeve: LUX
      "gid://shopify/p/78ZAJRRjFD4UM66klLS8Py", // LUX Short Sleeve Button Down
      "gid://shopify/p/2tKTbvaOeSdyu9qIAJlkD1", // Drop-Cut: BYLT Signature
      "gid://shopify/p/awBjsI10U5itEcVp3Wuma", // Drop-Cut Long Sleeve: LUX Polo
      "gid://shopify/p/6pUPHqMeMFCHK9FZQ2n9CI", // Henley Drop-Cut: LUX
      "gid://shopify/p/7I4plpQhS4dpQbkQM3ESHl", // Drop-Cut V-Neck: LUX
      "gid://shopify/p/VBqHWn4lCeXwz5Yzor43o", // Drop-Cut: LUX Polo
      "gid://shopify/p/2clsbttdxerabl8Et4ad68", // Executive Stretch 2.0 Short Sleeve Button Down - Classic
      "gid://shopify/p/6OzS0Nyj9vlIItCPbEbjDh", // Hooded Drop-Cut Long Sleeve
    ],
  },
  {
    id: "gid://shopify/Shop/21146461",
    title: "Culture Kings US",
    url: "https://www.culturekings.com",
    domain: "culture-kings-us.myshopify.com",
    products: [
      "gid://shopify/p/1iXeXcDpGBHGaCM0yDmnfC", // New Era New York Yankees 'Velvet Dreams' 9FORTY A-Frame Snap
      "gid://shopify/p/3HpGOncW5jhiH4Yc8nTEeB", // New Era Culture Kings 'Penny' 9FORTY A-Frame Snapback Maroon
      "gid://shopify/p/5eq7PDH4Z4F067ScUJavqr", // New Era Los Angeles Dodgers 'Pink Satin Hearts Walnut' 9FORT
      "gid://shopify/p/RFaYQXLuY7etnIfOl7YON", // New Era Los Angeles Kings 'All Day' 9FORTY A-Frame Snapback 
      "gid://shopify/p/8ZJ4RcMytml02Z0tpVi9D", // New Era Los Angeles Dodgers 'Distressed Denim 2.0' 9FORTY A-
      "gid://shopify/p/3ZEz37klJ5g350ghfstlvp", // New Era New Era X Culture Kings 'Croc Skin 2.0' 9FORTY A-Fra
      "gid://shopify/p/3qDqxfC9HmmVZ3dQPKhFHE", // New Era Los Angeles Dodgers 'Burgundy Hearts' 9FORTY A-Frame
      "gid://shopify/p/5deN1QEPXTgj5EG4r2wNpI", // New Era Los Angeles Dodgers 'All Day' 9FORTY A-Frame Snapbac
      "gid://shopify/p/16kRIjWAvzWmuQasHNXBuY", // New Era Boston Red Sox 'Velvet Hearts' 9FORTY A-Frame Snapba
      "gid://shopify/p/7adhMIjbmAs6Tn3tVQqOKP", // New Era USA 'World Baseball Classic' 9FORTY A-Frame Snapback
    ],
  },
  {
    id: "gid://shopify/Shop/56940298284",
    title: "Comfrt",
    url: "https://comfrt.com",
    domain: "comfrtclothing.myshopify.com",
    products: [
      "gid://shopify/p/5Q4QgqAgcb79keeXkKZBtA", // Cloud Zip Hoodie – Mega
      "gid://shopify/p/6vkrpOxpos93dzc8aDwBfj", // Signature Hoodie – Mega
      "gid://shopify/p/3w5Z6okFqgJwDei86k4d5l", // Pastel Hoodie – Mega
      "gid://shopify/p/26sPRUkmzch0j5GNyu9WMQ", // Signature Hoodie
      "gid://shopify/p/3cBSLzflXmVohLtZhwFeuW", // Tranquil Hoodie
      "gid://shopify/p/7sMllVcugSidTU51MDleNf", // Airplane Mode Travel Hoodie – Mega
      "gid://shopify/p/5AL0muMecjN9HFj8yopVRP", // Minimalist Sweatpants
      "gid://shopify/p/2sxaDnXffJPvZGOvwgLjo8", // Signature Sweatpants
      "gid://shopify/p/4ClI4LVpik7C13oSga86og", // Cloud Sweatpants
      "gid://shopify/p/2K0wbGPXauUhWbR7rXzE2c", // Camo Hoodie – Mega
    ],
  },
  {
    id: "gid://shopify/Shop/3918397529",
    title: "Cold Culture",
    url: "https://coldcultureworldwide.com",
    domain: "wolfus.myshopify.com",
    products: [
      "gid://shopify/p/66EhvuI7bniehRzbKek5nV", // CURVED HOODIE MIDNIGHT BLUE
      "gid://shopify/p/o3816JVWzqA7C3scBlYdf", // DISTRESSED DEFENSE HOODIE NAVY
      "gid://shopify/p/2SsEYeCZYz7AjIoS9v3Fae", // POSH ZIP HOODIE BURGUNDY
      "gid://shopify/p/6krRalDYEXD1JFcqx9846Z", // DISTRESS CURVED HOODIE BLACK
      "gid://shopify/p/6AwrMBl6tdjM5Oepn1LiPM", // DOWN TO LUCK HOODIE
      "gid://shopify/p/H8xCgAzJaJfCoiZSOx3Ch", // VERTICAL HOODIE BLACK
      "gid://shopify/p/oVVEKmtbmqe0k4qCbzzT4", // CHEERS LONGSLEEVE ROYAL BLUE
      "gid://shopify/p/2s2t7z8UClBXG38m7TXCOn", // NEW SCRIPT ZIP HOODIE BLACK
      "gid://shopify/p/5W6QRGhnjzb00hYe4Cm9PF", // CURVED HOODIE ASH GREY
      "gid://shopify/p/26iR2RDykOdPRDmOV7V3zi", // DREAM HOODIE LIGHT GREY
    ],
  },
  {
    id: "gid://shopify/Shop/11615808",
    title: "Elite Eleven",
    url: "https://eliteelevensporting.com",
    domain: "elite-eleven.myshopify.com",
    products: [
      "gid://shopify/p/2x8uoY9G0nY0Ok8hlWLvJm", // Classic Hoodie - Black
      "gid://shopify/p/7wE5MOUjLea7fZl9WA1hP7", // Classic Hoodie - Polar Grey
      "gid://shopify/p/3IHkutmkxfCgBzxfqtjUVA", // Classic Trackpants - Black
      "gid://shopify/p/5inSW2rTu9EH0n1J7kUtDV", // Omni Studio Trackpants V2 - Grey Marle
      "gid://shopify/p/6xOBHm5COrCY9gWTbHmsLJ", // Classic Straight Leg Pants - Black
      "gid://shopify/p/1GRW4rz7kL6WHoitXpSPlC", // Classic Relaxed Zip Through - Coffee Bean
      "gid://shopify/p/38Wj33Mq7IWu7YV0NjJJsK", // Classic Hoodie - Grey
      "gid://shopify/p/709ROGASPpWdZqvFRKe0dm", // Omni Wide Leg Trackpants - Black
      "gid://shopify/p/4B8UIXiNyBQ6gwejwaj2sQ", // Icon Hoodie - Black
      "gid://shopify/p/5uSJuqC9a5jexhNcnNubeO", // Classic Trackpants - Polar Grey
    ],
  },
  {
    id: "gid://shopify/Shop/60330311875",
    title: "KICKS CREW",
    url: "https://account.kickscrew.com",
    domain: "kickscrewshop.myshopify.com",
    products: [
      "gid://shopify/p/4YUHKjMduX27Rop2TUqUcy", // Nike x Supreme Air Force 1 Low 'Box Logo - White' CU9225-100
      "gid://shopify/p/1HSFfA1ye33pfMJdGSqV1Y", // Air Jordan 11 Retro 'Green Screen' IQ5700-900
      "gid://shopify/p/49mw8bhiWk9xkBVOdxrVyw", // Air Jordan 13 Retro 'Midnight Navy' 414571-140
      "gid://shopify/p/JmmVNtclkjTvVEFZd7SHa", // adidas Yeezy Slide 'Onyx' HQ6448
      "gid://shopify/p/5A17GPZugAzbp2EnYV3i0L", // (GS) Air Jordan 5 Retro OG 'Black Metallic Reimagined' HF397
      "gid://shopify/p/1ygTkBaYolvcOUYtya8k3O", // Air Jordan 12 Retro 'Flu Game' 2016 130690-002
      "gid://shopify/p/5LBjYs1LvERgr5mChvSUlO", // Air Jordan 4 Retro 'Bred Reimagined' FV5029-006
      "gid://shopify/p/1inhmofoGEKMERY23cdLE", // Air Jordan 11 'Legend Blue' 2024 CT8012-104
      "gid://shopify/p/53seSouwboef6s9eWH0OS8", // (WMNS) Nike Air Max 95 'Black Pink Foam' HJ5996-001
      "gid://shopify/p/2DiNWzKSWo1LDPK1l08Vvi", // adidas Yeezy Boost 700 'Wave Runner' B75571
    ],
  },
  {
    id: "gid://shopify/Shop/29145366588",
    title: "ShopSimon",
    url: "https://shop.simon.com",
    domain: "shoppremiumoutlets.myshopify.com",
    products: [
      "gid://shopify/p/br3Y0gQnwviXFNdtLueVb", // Women's adidas Advantage Shoes
      "gid://shopify/p/6iDNKFqXPF16hul1vmk0ch", // Women's adidas VL Court 3.0 Shoes
      "gid://shopify/p/55VLEjiskOe98GeGe5NVYg", // Coach Outlet City Tote Bag In Signature Canvas
      "gid://shopify/p/1jAOweFpMR0tqAwWIMzZkN", // Coach Outlet Carey Crossbody Bag In Signature Canvas
      "gid://shopify/p/7mvF52ft1HtrFUP41Lvp7V", // On Running Cloud 6 Sneaker
      "gid://shopify/p/RCH18jZWEPtnCdLZHr1hT", // Coach Outlet Mini Carey Crossbody Bag In Signature Canvas
      "gid://shopify/p/4Pw1NebM0aneOzuizBGrPN", // Men's adidas TECHNOCHAOS 2000 Shoes
      "gid://shopify/p/6ZWOrQ7MTdTABvkgmfGnpx", // Coach Outlet Roller Buckle Cut To Size Reversible Belt, 38 M
      "gid://shopify/p/YaRPlDWOsuTETnUKFPAk0", // Coach Outlet Plaque Buckle Cut To Size Reversible Belt, 38 M
      "gid://shopify/p/4Uhwtko0UJSBVH6BCwRTNY", // Coach Outlet Signature Wrap
    ],
  },
  {
    id: "gid://shopify/Shop/2147974",
    title: "Sneaker Politics",
    url: "https://sneakerpolitics.com",
    domain: "sneakerpolitics.myshopify.com",
    products: [
      "gid://shopify/p/6AR9fxtO0TqAKvLtLkfbyL", // Politics x Reebok Workout Plus 'Wishing Ritual' - White/Alab
      "gid://shopify/p/2hnbQR7gahqpofC6H2ftWw", // Nike Air Max 95 OG Leather 'Paisley' - White/Black
      "gid://shopify/p/599bIU23p7IEwY0ruKkIvv", // Nike Air Max 95 OG - Mink Brown/Filbert
      "gid://shopify/p/5mLgup944aj2uTjcn3AisG", // Nike Air Foamposite Pro Premium 'Glow In The Dark' - Summit 
      "gid://shopify/p/7oOu8Y43X8kvXTbUeeAcvJ", // Nike ACG LDV - Varsity Red/Wolf Grey
      "gid://shopify/p/3NFmRrRZAoKuFU5eWRYgVI", // Godspeed New York High Stakes Tee - White
      "gid://shopify/p/3ntplbWgChBwYekxZiU6j4", // Politics x Timberland 6" Waterproof Boot 'Rodeo' - Brown
      "gid://shopify/p/2vbKvYmTav6qzs9gcqKedz", // Criminal Damage Registration Tee - White
      "gid://shopify/p/6QFNomxhgdsSpZaibNzOUP", // Ice Cream Suppressor Knit Tee - Jet Set
      "gid://shopify/p/4MyCBRXxeZejNKX3FARNGQ", // Godspeed New York Freedoms Protocol Tee - Grey Wash
    ],
  },
  {
    id: "gid://shopify/Shop/13343831",
    title: "NRML",
    url: "https://nrml.ca",
    domain: "nrmlstreetwear.myshopify.com",
    products: [
      "gid://shopify/p/5snJnXWWWVh0EcbPwISmdc", // AIR FORCE 1 RETRO "PATENT DENIM" COASTAL BLUE
      "gid://shopify/p/3qbNICMCqI8HDoQfHZOcNv", // AIR FORCE 1 LOW PROTRO OBSIDIAN/SAFETY ORANGE "DENIM"
      "gid://shopify/p/1UjuHoNGJ23SCEcX8FfIHt", // AIR FORCE 1 CAMPFIRE ORANGE
      "gid://shopify/p/1cwLrdcyQRmh500F6WPf83", // DUNK LOW RETRO SE BLACK / PALE IVORY-ANTHRACITE
      "gid://shopify/p/3AugNa7uspVfCdKCAS2Kps", // 1954R TRIPLE BLACK
      "gid://shopify/p/7ew5O3uAlMb5yRIa7c7501", // AIR FORCE 1 GORE-TEX VIBRAM OFF NOIR
      "gid://shopify/p/3D3DWmwJw8VJ9bW4q7l1j3", // OTTAWA BLACKJACKS X NRML 9FORTY CAP BLACK
      "gid://shopify/p/3ui4dGW8XC63uur0ofhORd", // AIR MAX 95 BIG BUBBLE LEATHER WHITE/BLACK
      "gid://shopify/p/6ASx0DJ4SEaoLrFCDDJ1lS", // BASE BALACLAVA TNF BLACK
      "gid://shopify/p/1vNVLgPzZriCJ2CiIFTJ6i", // AIR FORCE 1 LX BLACK / METALLIC SILVER
    ],
  },
  {
    id: "gid://shopify/Shop/25261506665",
    title: "Midway Sports",
    url: "https://midwaysports.com",
    domain: "midway-sports.myshopify.com",
    products: [
      "gid://shopify/p/53JEqODfNtKuOvWg4bNc0T", // Nike Men's Windrunner Hooded Training Windbreaker
      "gid://shopify/p/3IyJWXTt1KNS4MTDlJxViT", // Nike Men's Dri-FIT Team Flex Woven Training Shorts (Stock)
      "gid://shopify/p/5DRRCkf68jfVDeARLxWgAY", // Nike Men's Dri-FIT Lightweight Pregame Jacket (Stock)
      "gid://shopify/p/59cjOmSuH3ZKnbB9UvxurB", // Nike Men's Team FZ Jacket Dry Woven
      "gid://shopify/p/3lm1GAaqLQYmp1Dq2wsUI3", // Nike Men's Team Anorak
      "gid://shopify/p/2f3wDBnc6ULKBszsDAXuRS", // Nike Men's Therma Pullover Hoodie (Standard Fit)
      "gid://shopify/p/29BPP2txbrP6Uo7DX8UGkD", // Nike Men's Team Legend Long Sleeve Crew (Standard Fit)
      "gid://shopify/p/3o913WFsX6GdzQEzDtGlTu", // Nike Men's Team Fl Relentless Pant
      "gid://shopify/p/1WlZOIakGmzCGgnNRrzCqx", // Nike Men's Pro Tight SS Training Top (Tight Fit)
      "gid://shopify/p/4EoG8AEtHodzsPiOHmIwyF", // Nike Men's Therma Set - Hoodie and Pants
    ],
  },
  {
    id: "gid://shopify/Shop/8173919",
    title: "'47",
    url: "https://www.47brand.com",
    domain: "47brand.myshopify.com",
    products: [
      "gid://shopify/p/4m43QH3HBknHCihSfDRz1B", // LOS ANGELES DODGERS '47 CLEAN UP
      "gid://shopify/p/6CuouMNASRn4tPY4le0O16", // BOSTON RED SOX '47 CLEAN UP
      "gid://shopify/p/2wiCexjvcVgGhsZC1tFaFb", // '47 BASICS CLEAN UP
      "gid://shopify/p/3aFGghCI5oiLT0txSUz8om", // GERMAN SHEPHERD TWO TONE '47 CLEAN UP
      "gid://shopify/p/54QbrYP5lzrzxXFNGbaJK9", // '47 BASICS CLEAN UP
      "gid://shopify/p/2SwJpvYDzfkeghf3WD4g9S", // LOS ANGELES DODGERS '47 CLEAN UP
      "gid://shopify/p/5IJfkdq8TOFEiV2UkHNzhG", // PHILADELPHIA EAGLES HISTORIC BOW BACK '47 WOMEN'S CLEAN UP
      "gid://shopify/p/78ntGWVmbhfLgaEsP0tbJh", // '47 BASICS CLEAN UP
      "gid://shopify/p/3uoIGXtgMormYo6QiYpFqh", // NEW YORK YANKEES '47 CLEAN UP
      "gid://shopify/p/2qTpDJULEN9Mpth3EjYDD", // CHICAGO CUBS '47 CLEAN UP
    ],
  },
  {
    id: "gid://shopify/Shop/60125544675",
    title: "New Era Cap",
    url: "https://warehouse.neweracap.com",
    domain: "us-neweracap.myshopify.com",
    products: [
      "gid://shopify/p/49uktQhuCgjqt2hEPDbTJ1", // New York Yankees Black and White Basic 59FIFTY Fitted Hat
      "gid://shopify/p/77zZYepsYOjXgAF5CsoAJe", // New York Yankees Authentic Collection 59FIFTY Fitted Hat
      "gid://shopify/p/9FSXrTnmj6zMgrEnq2DI7", // Los Angeles Dodgers Authentic Collection 59FIFTY Fitted Hat
      "gid://shopify/p/7KIDI99NCzgyf1pbJZ91yi", // Mexico Baseball New Era Anniversary Logos Black on Black 59F
      "gid://shopify/p/6j4J3W76cls7ZNYe1mCm5S", // Los Angeles Dodgers City Connect 59FIFTY Fitted Hat
      "gid://shopify/p/1vS7JoWHADQ17ezciqH8rj", // Los Angeles Dodgers Scarlet Basic 59FIFTY Fitted Hat
      "gid://shopify/p/6BY2UldI2IXxmJ2WilJC4t", // New York Yankees Chrome 59FIFTY Fitted Trucker Hat
      "gid://shopify/p/51VxhniuX1PVnfOYxdzbcb", // Atlanta Braves Authentic Collection Home 59FIFTY Fitted Hat
      "gid://shopify/p/5U9KRsXmrIR9S8HipZpeM6", // New York Yankees World Series Side Patch 59FIFTY Fitted Hat
      "gid://shopify/p/4E7qeonZNMjVnQHTFtR3sr", // Mexico Baseball Home 59FIFTY Fitted Hat
    ],
  },
  {
    id: "gid://shopify/Shop/7743668321",
    title: "New York or Nowhere",
    url: "https://newyorkornowhere.com",
    domain: "new-york-or-nowhere.myshopify.com",
    products: [
      "gid://shopify/p/4D8e5dhZn2567rJLN2xJxM", // Motto T-Shirt
      "gid://shopify/p/6MEciH97ZXYQ7XsKCv9TMm", // Signature T-Shirt
      "gid://shopify/p/347TnMxA1NvduO29OvHAzp", // Yankees Signature Hoodie
      "gid://shopify/p/6edMDljENCxdPWRGOR0xz1", // Yankees Motto T-Shirt
      "gid://shopify/p/7w3MkyG2aeu1WYMnAyio4Z", // Yankees Motto 9FORTY Snapback
      "gid://shopify/p/4Br2UOLpPOZl6YhTQrBDSb", // Knicks Motto Relaxed Crewneck
      "gid://shopify/p/4N6fHfhgwBXmOiaFlNCwPZ", // Knicks 1994 9FORTY Snapback
      "gid://shopify/p/5qWXptiQB3cjssPCnLRtfw", // Yankees Watercolor T-Shirt
      "gid://shopify/p/2Ps5blifZ9wqKmzSrCIV65", // Knicks Crossover 9TWENTY Baseball Cap
      "gid://shopify/p/6DMc1Ftc0YLCnTDcdZJi5w", // Motto Snapback
    ],
  },
]
