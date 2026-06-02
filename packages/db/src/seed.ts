/**
 * Database seed script.
 *
 * Idempotent: safe to run multiple times. Uses upsert on unique fields
 * (User.email, Category.slug, Product.slug) so re-running won't create
 * duplicates and won't wipe existing rows.
 *
 * Run locally:
 *   npm run db:seed
 *
 * Run on Render:
 *   The startCommand in render.yaml runs `db:migrate:deploy` on every boot.
 *   We append `db:seed` after it so a freshly-wiped free-tier Postgres gets
 *   re-populated automatically. Existing data is preserved on subsequent boots
 *   thanks to the upserts.
 *
 * Images:
 *   ProductImage rows are intentionally NOT created here. Add them manually
 *   (Cloudinary publicId + url) once you've uploaded assets.
 */

import * as path from "node:path";
import * as dotenv from "dotenv";

// Load env files BEFORE importing prisma client (which reads DATABASE_URL at
// construction time). Resolve relative to this file so the seed works no
// matter the cwd. Order: monorepo root .env → apps/api/.env → local cwd.
// `override: false` (the default) means earlier files win on conflicts.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import { cloudinaryBaseUrl, UserRole } from "@repo/shared";
dotenv.config({ path: path.resolve(__dirname, "../../../apps/api/.env") });
dotenv.config();

import argon2 from "argon2";
import { prisma } from "./index.js";

// ─── Config ────────────────────────────────────────────────────────────

const CURRENCY = "USD";

const USERS = [
  {
    email: "admin@test.com",
    password: "admin123",
    name: "Admin",
    role: "ADMIN" as const,
  },
  {
    email: "damin@test.com",
    password: "damin123",
    name: "Damin",
    role: UserRole.CUSTOMER,
  },
];

type ImageSeed = {
  publicId: string;
  alt?: string;
};

type ProductSeed = {
  slug: string;
  sku: string;
  name: string;
  description: string;
  priceMinor: bigint;
  physicalStock: number;
  /**
   * Cloudinary public IDs in display order (index 0 = primary).
   * Leave empty to skip images for this product. The full URL is built
   * from CLOUDINARY_CLOUD_NAME at seed time.
   *
   * Example:
   *   images: [
   *     { publicId: "ecomm/products/iphone-17-front" },
   *     { publicId: "ecomm/products/iphone-17-back", alt: "Back view" },
   *   ]
   */
  images: ImageSeed[];
};

type SubcategorySeed = {
  slug: string;
  name: string;
  products: [ProductSeed, ProductSeed];
};

type CategorySeed = {
  slug: string;
  name: string;
  children: [SubcategorySeed, SubcategorySeed, SubcategorySeed];
};

const p = (
  slug: string,
  name: string,
  description: string,
  priceMinor: number,
  images: ImageSeed[] = [],
  physicalStock = 25,
  sku?: string,
): ProductSeed => ({
  slug,
  // Derive SKU from slug when none provided, e.g. "iphone-17" → "IPHONE-17"
  sku: (sku || slug).toUpperCase().substring(0, 50),
  name,
  description,
  priceMinor: BigInt(priceMinor),
  physicalStock,
  images,
});

const CATEGORIES: CategorySeed[] = [
  {
    slug: "electronics",
    name: "Electronics",
    children: [
      {
        slug: "mobiles",
        name: "Mobiles",
        products: [
          p(
            "iphone-17",
            "iPhone 17",
            "Apple's latest flagship smartphone with A19 chip.",
            99900,
            [
                { publicId: "ecomm/products/nzhjicnvhqmprnql2ehq" },
                { publicId: "ecomm/products/iphone_17_3" },
                { publicId: "ecomm/products/iphone_17_4" },
            ],
            25,
            "APL-IPH17-BLK",
          ),
          p(
            "samsung-galaxy-s25",
            "Samsung Galaxy S25",
            "Samsung flagship with Snapdragon 8 Gen 4.",
            89900,
            [
                { publicId: "ecomm/products/s25ultra_v7iu1o" },
                { publicId: "ecomm/products/s25ultra_wvodei" },
            ],
            25,
            "SAM-S25-256",
          ),
        ],
      },
      {
        slug: "laptops",
        name: "Laptops",
        products: [
          p(
            "macbook-pro-16-m5",
            "MacBook Pro 16 M5",
            "16-inch MacBook Pro with M5 Pro chip.",
            249900,
            [{ publicId: "ecomm/products/mbpro16_wafys7" }],
            25,
            "APL-MBP16-M5",
          ),
          p(
            "dell-xps-15",
            "Dell XPS 15",
            "Premium 15-inch ultrabook with OLED display.",
            189900,
            [{ publicId: "dellxps15_dqznef" }],
            25,
            "DEL-XPS15-1TB",
          ),
        ],
      },
      {
        slug: "headphones",
        name: "Headphones",
        products: [
          p(
            "sony-wh-1000xm6",
            "Sony WH-1000XM6",
            "Industry-leading noise cancelling headphones.",
            39900,
            [{ publicId: "sonyhp_ngqybn" }],
            25,
            "SON-1000XM6",
          ),
          p(
            "bose-quietcomfort-ultra",
            "Bose QuietComfort Ultra",
            "Premium over-ear ANC headphones.",
            42900,
            [{ publicId: "bose_vzsqdi" }],
            25,
            "BOS-QC-ULTRA",
          ),
        ],
      },
    ],
  },
  {
    slug: "fashion",
    name: "Fashion",
    children: [
      {
        slug: "mens-clothing",
        name: "Men's Clothing",
        products: [
          p(
            "classic-oxford-shirt",
            "Classic Oxford Shirt",
            "Timeless cotton oxford in white.",
            4500,
            [{ publicId: "shirt1_b6c9dt" }],
            25,
            "MEN-OXF-WHT",
          ),
          p(
            "slim-fit-chinos",
            "Slim Fit Chinos",
            "Stretch cotton chinos in khaki.",
            5500,
            [{ publicId: "chinos_szmyqm" }],
            25,
            "MEN-CHN-KHK",
          ),
        ],
      },
      {
        slug: "womens-clothing",
        name: "Women's Clothing",
        products: [
          p(
            "wrap-midi-dress",
            "Wrap Midi Dress",
            "Flattering wrap dress in floral print.",
            6900,
            [{ publicId: "women1_jjupje" }],
            25,
            "WMN-WRP-FLOR",
          ),
          p(
            "high-waist-jeans",
            "High Waist Jeans",
            "Vintage-inspired denim with raw hem.",
            8900,
            [{ publicId: "womenjeans_bygouh" }],
            25,
            "WMN-JNS-RAW",
          ),
        ],
      },
      {
        slug: "shoes",
        name: "Shoes",
        products: [
          p(
            "air-jordan-1-retro",
            "Air Jordan 1 Retro",
            "Iconic high-top sneaker.",
            17000,
            [{ publicId: "jordan_syxbdv" }],
            25,
            "NIK-AJ1-RETRO",
          ),
          p(
            "adidas-ultraboost-25",
            "Adidas Ultraboost 25",
            "Energy-returning running shoe.",
            19000,
            [{ publicId: "devas_wngkyg" }],
            25,
            "ADI-UB25-RUN",
          ),
        ],
      },
    ],
  },
  {
    slug: "home-kitchen",
    name: "Home & Kitchen",
    children: [
      {
        slug: "cookware",
        name: "Cookware",
        products: [
          p(
            "cast-iron-skillet-12",
            "Cast Iron Skillet 12\"",
            "Pre-seasoned heavy-duty skillet.",
            4500,
            [{ publicId: "pubgpan_xcckff" }],
            25,
            "LOD-CIS-12IN",
          ),
          p(
            "stainless-saucepan-set",
            "Stainless Saucepan Set",
            "3-piece tri-ply saucepan set.",
            12900,
            [{ publicId: "womansetup_jcn39y" }],
            25,
            "CUI-SSP-3PC",
          ),
        ],
      },
      {
        slug: "small-appliances",
        name: "Small Appliances",
        products: [
          p(
            "instant-pot-pro",
            "Instant Pot Pro",
            "10-in-1 pressure cooker.",
            12900,
            [{ publicId: "iss_wjj7rf" }],
            25,
            "INS-IP-PRO",
          ),
          p(
            "vitamix-a3500",
            "Vitamix A3500",
            "Professional-grade blender.",
            64900,
            [{ publicId: "juicepilado_svib5s" }],
            25,
            "VIT-A3500-PR",
          ),
        ],
      },
      {
        slug: "bedding",
        name: "Bedding",
        products: [
          p(
            "egyptian-cotton-sheets",
            "Egyptian Cotton Sheets",
            "1000 thread count, queen size.",
            13900,
            [{ publicId: "bedsheet_feuwxq" }],
            25,
            "LIN-ECS-QN",
          ),
          p(
            "down-alternative-comforter",
            "Down Alternative Comforter",
            "All-season hypoallergenic.",
            8900,
            [{ publicId: "bedsheet2_sseok9" }],
            25,
            "LIN-DAC-AS",
          ),
        ],
      },
    ],
  },
  {
    slug: "books",
    name: "Books",
    children: [
      {
        slug: "fiction",
        name: "Fiction",
        products: [
          p(
            "the-midnight-library",
            "The Midnight Library",
            "Novel by Matt Haig.",
            1500,
            [{ publicId: "book1_uwnq2t" }],
            25,
            "PEN-TML-PB",
          ),
          p(
            "project-hail-mary",
            "Project Hail Mary",
            "Sci-fi by Andy Weir.",
            1700,
            [{ publicId: "book2_euxmxe" }],
            25,
            "PEN-PHM-PB",
          ),
        ],
      },
      {
        slug: "non-fiction",
        name: "Non-Fiction",
        products: [
          p(
            "atomic-habits",
            "Atomic Habits",
            "Self-help by James Clear.",
            1800,
            [{ publicId: "book3_bl3egg" }],
            25,
            "PEN-ATH-PB",
          ),
          p(
            "sapiens",
            "Sapiens",
            "A Brief History of Humankind.",
            2000,
            [{ publicId: "book4_u4a4wc" }],
            25,
            "PEN-SAP-PB",
          ),
        ],
      },
      {
        slug: "childrens-books",
        name: "Children's Books",
        products: [
          p(
            "where-the-wild-things-are",
            "Where the Wild Things Are",
            "Maurice Sendak classic.",
            1200,
            [{ publicId: "book5_b3ynou" }],
            25,
            "PEN-WTA-HC",
          ),
          p(
            "the-very-hungry-caterpillar",
            "The Very Hungry Caterpillar",
            "Eric Carle classic.",
            1100,
            [{ publicId: "book5_jemwk8" }],
            25,
            "PEN-VHC-BOARD",
          ),
        ],
      },
    ],
  },
  {
    slug: "sports-outdoors",
    name: "Sports & Outdoors",
    children: [
      {
        slug: "fitness",
        name: "Fitness",
        products: [
          p(
            "adjustable-dumbbells",
            "Adjustable Dumbbells",
            "5–52.5 lb pair.",
            39900,
            [{ publicId: "dumbell_x7rcfd" }],
            25,
            "BOW-ADB-552",
          ),
          p(
            "yoga-mat-pro",
            "Yoga Mat Pro",
            "6mm extra-thick non-slip mat.",
            5900,
            [{ publicId: "yogamat_ozpucu" }],
            25,
            "LUL-YMP-6MM",
          ),
        ],
      },
      {
        slug: "camping",
        name: "Camping",
        products: [
          p(
            "4-person-tent",
            "4-Person Tent",
            "Waterproof family tent.",
            14900,
            [{ publicId: "tent_trcaon" }],
            25,
            "REI-TNT-4P",
          ),
          p(
            "down-sleeping-bag",
            "Down Sleeping Bag",
            "20°F mummy bag.",
            17900,
            [{ publicId: "sleepingbag_vdn9ok" }],
            25,
            "REI-DSB-20F",
          ),
        ],
      },
      {
        slug: "cycling",
        name: "Cycling",
        products: [
          p(
            "road-bike-carbon",
            "Carbon Road Bike",
            "Entry-level carbon frame.",
            149900,
            [{ publicId: "bike_w4owsw" }],
            25,
            "TRE-CRB-ENT",
          ),
          p(
            "mtb-hardtail-29",
            "Hardtail MTB 29\"",
            "Aluminum hardtail mountain bike.",
            89900,
            [{ publicId: "bike2_p2ls6d" }],
            25,
            "TRE-HTMTB-29",
          ),
        ],
      },
    ],
  },
  {
    slug: "beauty",
    name: "Beauty",
    children: [
      {
        slug: "skincare",
        name: "Skincare",
        products: [
          p(
            "vitamin-c-serum",
            "Vitamin C Serum",
            "20% L-ascorbic acid serum.",
            3500,
            [{ publicId: "vcser_pyob2o" }],
            25,
            "SOM-VCS-20",
          ),
          p(
            "hyaluronic-acid",
            "Hyaluronic Acid",
            "Hydrating face serum.",
            1900,
            [{ publicId: "hacid_cgwfhh" }],
            25,
            "SOM-HYA-SER",
          ),
        ],
      },
      {
        slug: "makeup",
        name: "Makeup",
        products: [
          p(
            "matte-liquid-lipstick",
            "Matte Liquid Lipstick",
            "Long-wearing matte finish.",
            2200,
            [{ publicId: "lipstick_vprqte" }],
            25,
            "NYX-MLL-MAT",
          ),
          p(
            "waterproof-mascara",
            "Waterproof Mascara",
            "Volume + length mascara.",
            2500,
            [{ publicId: "mascara_ol8j6g" }],
            25,
            "TFS-WPM-VOL",
          ),
        ],
      },
      {
        slug: "haircare",
        name: "Haircare",
        products: [
          p(
            "argan-oil-shampoo",
            "Argan Oil Shampoo",
            "Sulfate-free moisturizing.",
            1800,
            [{ publicId: "arganoil_w3uvmo" }],
            25,
            "SHE-AOS-SF",
          ),
          p(
            "deep-conditioner",
            "Deep Conditioner",
            "Weekly hair mask.",
            2400,
            [{ publicId: "condi_bfelwk" }],
            25,
            "SHE-DC-WK",
          ),
        ],
      },
    ],
  },
  {
    slug: "toys-games",
    name: "Toys & Games",
    children: [
      {
        slug: "board-games",
        name: "Board Games",
        products: [
          p(
            "catan",
            "Catan",
            "Strategic resource trading game.",
            4500,
            [{ publicId: "catan_vvhevj" }],
            25,
            "CAT-CATAN-BG",
          ),
          p(
            "ticket-to-ride",
            "Ticket to Ride",
            "Cross-country train adventure.",
            5500,
            [{ publicId: "ttr_rdgici" }],
            25,
            "DOY-TTR-NA",
          ),
        ],
      },
      {
        slug: "lego",
        name: "LEGO",
        products: [
          p(
            "lego-millennium-falcon",
            "LEGO Millennium Falcon",
            "7,541-piece UCS set.",
            84900,
            [{ publicId: "lego1_tnkdjg" }],
            25,
            "LEG-MF-UCS",
          ),
          p(
            "lego-creator-house",
            "LEGO Creator Modular House",
            "3-in-1 build set.",
            8900,
            [{ publicId: "lego2_jticpi" }],
            25,
            "LEG-CMH-3N1",
          ),
        ],
      },
      {
        slug: "video-games",
        name: "Video Games",
        products: [
          p(
            "red-dead-redemption-II",
            "Red Dead Redemption 2",
            "Playstation 4.",
            5900,
            [{ publicId: "rdr2_uhhmfu" }],
            25,
            "RKT-RDR2-PS4",
          ),
          p(
            "god-of-war-ragnarok",
            "God of War Ragnarök",
            "PlayStation 5.",
            6900,
            [{ publicId: "gowr_cssh3y" }],
            25,
            "SNY-GOWR-PS5",
          ),
        ],
      },
    ],
  },
  {
    slug: "groceries",
    name: "Groceries",
    children: [
      {
        slug: "coffee-tea",
        name: "Coffee & Tea",
        products: [
          p(
            "ethiopian-single-origin",
            "Ethiopian Single Origin",
            "Whole bean, 12oz light roast.",
            1800,
            [{ publicId: "tea1_t5ucdq" }],
            25,
            "BLU-ETH-12OZ",
          ),
          p(
            "matcha-ceremonial",
            "Ceremonial Grade Matcha",
            "30g stone-ground matcha.",
            2900,
            [{ publicId: "tea2_ne4ggv" }],
            25,
            "CER-MAT-30G",
          ),
        ],
      },
      {
        slug: "snacks",
        name: "Snacks",
        products: [
          p(
            "dark-chocolate-bar-85",
            "85% Dark Chocolate Bar",
            "Single-origin Ecuadorian.",
            600,
            [{ publicId: "choco_ewnrnm" }],
            25,
            "CHO-DC85-ECU",
          ),
          p(
            "mixed-nuts-roasted",
            "Mixed Nuts (Roasted)",
            "1lb sea-salt mix.",
            1500,
            [{ publicId: "oats_z5qint" }],
            25,
            "NUT-MXR-1LB",
          ),
        ],
      },
      {
        slug: "pantry",
        name: "Pantry",
        products: [
          p(
            "extra-virgin-olive-oil",
            "Extra Virgin Olive Oil",
            "First cold-pressed, 500ml.",
            2200,
            [{ publicId: "oil_s3f62q" }],
            25,
            "OLI-EVOO-500",
          ),
          p(
            "aged-balsamic-vinegar",
            "Aged Balsamic Vinegar",
            "Modena, 250ml.",
            2800,
            [{ publicId: "oil2_k7exbm" }],
            25,
            "MOD-BAL-250",
          ),
        ],
      },
    ],
  }
];

// ─── Seed runner ───────────────────────────────────────────────────────

async function seedUsers() {
  for (const u of USERS) {
    const passwordHash = await argon2.hash(u.password, { type: argon2.argon2id });
    await prisma.user.upsert({
      where: { email: u.email },
      // Re-hash on every run so password changes here propagate.
      update: { name: u.name, role: u.role, passwordHash },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
      },
    });
    console.log(`  user: ${u.email} (${u.role})`);
  }
}

async function seedCatalog() {
  for (const cat of CATEGORIES) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, parentId: null, deletedAt: null, isActive: true },
      create: { slug: cat.slug, name: cat.name },
    });
    console.log(`  category: ${cat.name}`);

    for (const sub of cat.children) {
      const child = await prisma.category.upsert({
        where: { slug: sub.slug },
        update: { name: sub.name, parentId: parent.id, deletedAt: null, isActive: true },
        create: { slug: sub.slug, name: sub.name, parentId: parent.id },
      });
      console.log(`    └─ ${sub.name}`);

      for (const prod of sub.products) {
        const product = await prisma.product.upsert({
          where: { slug: prod.slug },
          update: {
            sku: prod.sku,
            name: prod.name,
            description: prod.description,
            priceMinor: prod.priceMinor,
            currency: CURRENCY,
            physicalStock: prod.physicalStock,
            isActive: true,
            categoryId: child.id,
          },
          create: {
            slug: prod.slug,
            sku: prod.sku,
            name: prod.name,
            description: prod.description,
            priceMinor: prod.priceMinor,
            currency: CURRENCY,
            physicalStock: prod.physicalStock,
            isActive: true,
            categoryId: child.id,
          },
        });
        console.log(`        • ${prod.name}`);

        // Upsert images keyed by (productId, position). Re-running the seed
        // refreshes URLs/alts in-place; positions not present here are left
        // alone (delete them manually if you want them gone).
        // Empty publicId entries are skipped so you can scaffold first and
        // fill in real Cloudinary IDs later without breaking the seed.
        for (let i = 0; i < prod.images.length; i++) {
          const img = prod.images[i]!;
          if (!img.publicId.trim()) continue;
          const url = cloudinaryBaseUrl(img.publicId);
          await prisma.productImage.upsert({
            where: {
              productId_position: { productId: product.id, position: i },
            },
            update: {
              url,
              publicId: img.publicId,
              alt: img.alt ?? null,
            },
            create: {
              productId: product.id,
              url,
              publicId: img.publicId,
              alt: img.alt ?? null,
              position: i,
            },
          });
        }
      }
    }
  }
}

async function main() {
  console.log("Seeding users…");
  await seedUsers();
  console.log("Seeding categories & products…");
  await seedCatalog();
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
