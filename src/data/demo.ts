import type { Collection, Product, Service } from "@/types/catalog";

const nailImage = (
  src: string,
  en: string,
  zh: string,
): Product["images"][number] => ({
  src: `${src}?auto=format&fit=crop&w=1200&q=85`,
  alt: { en, zh },
  width: 1200,
  height: 1500,
});

export const collections: Collection[] = [
  {
    slug: "moonlit-metal",
    name: { en: "Moonlit Metal", zh: "月光金属" },
    description: {
      en: "Liquid chrome, sculptural lines, and a flash of midnight.",
      zh: "流动的金属光泽、立体线条与一抹午夜色彩。",
    },
    image: nailImage(
      "https://images.unsplash.com/photo-1632345031435-8727f6897d53",
      "Silver chrome manicure with sculptural details",
      "带有立体细节的银色镜面美甲",
    ),
  },
  {
    slug: "petal-study",
    name: { en: "Petal Study", zh: "花瓣习作" },
    description: {
      en: "Botanical details painted with the patience of a miniature.",
      zh: "以微型画般的耐心描绘植物细节。",
    },
    image: nailImage(
      "https://images.unsplash.com/photo-1604654894610-df63bc536371",
      "Soft pink botanical nail art",
      "柔粉色植物美甲",
    ),
  },
  {
    slug: "after-dark",
    name: { en: "After Dark", zh: "夜幕之后" },
    description: {
      en: "Inky color, glassy shine, and jewelry-like accents.",
      zh: "墨色、玻璃光泽与珠宝般的点缀。",
    },
    image: nailImage(
      "https://images.unsplash.com/photo-1610992015732-2449b76344bc",
      "Dark jewel-toned manicure",
      "深色珠宝调美甲",
    ),
  },
];

export const products: Product[] = [
  {
    id: "prd_lunar_relic",
    slug: "lunar-relic",
    name: { en: "Lunar Relic", zh: "月之遗珍" },
    description: {
      en: "Smoked chrome, pearl fragments, and hand-sculpted silver orbitals.",
      zh: "烟熏镜面、珍珠碎片与手工塑造的银色轨道。",
    },
    story: {
      en: "A tiny nocturne for your hands, built in translucent layers and finished one set at a time.",
      zh: "为双手创作的微型夜曲，以半透明层次构成，每套独立完成。",
    },
    category: "press-ons",
    collection: "moonlit-metal",
    tags: ["chrome", "sculpted", "silver"],
    price: 58,
    compareAtPrice: 68,
    images: [
      nailImage(
        "https://images.unsplash.com/photo-1632345031435-8727f6897d53",
        "Lunar Relic silver chrome press-on nails",
        "月之遗珍银色镜面穿戴甲",
      ),
      nailImage(
        "https://images.unsplash.com/photo-1610992015732-2449b76344bc",
        "Lunar Relic nails shown in hand",
        "手部佩戴月之遗珍穿戴甲",
      ),
    ],
    shapes: ["Almond", "Coffin", "Oval"],
    sizes: ["XS", "S", "M", "L", "Custom"],
    finishes: ["Gloss", "Velvet"],
    stock: 18,
    featured: true,
    bestseller: true,
  },
  {
    id: "prd_rose_frequency",
    slug: "rose-frequency",
    name: { en: "Rose Frequency", zh: "玫瑰频率" },
    description: {
      en: "Sheer rose quartz with fine magnetic ribbons and tiny silver stars.",
      zh: "通透玫瑰石英色，搭配细腻猫眼光带与银色星点。",
    },
    story: {
      en: "A romantic signal from somewhere just beyond the atmosphere.",
      zh: "来自大气层之外的一段浪漫讯号。",
    },
    category: "press-ons",
    collection: "petal-study",
    tags: ["pink", "cat-eye", "romantic"],
    price: 52,
    images: [
      nailImage(
        "https://images.unsplash.com/photo-1604654894610-df63bc536371",
        "Rose Frequency pink cat-eye press-on nails",
        "玫瑰频率粉色猫眼穿戴甲",
      ),
    ],
    shapes: ["Almond", "Round"],
    sizes: ["XS", "S", "M", "L", "Custom"],
    finishes: ["Gloss"],
    stock: 24,
    featured: true,
    newArrival: true,
  },
  {
    id: "prd_ink_orchid",
    slug: "ink-orchid",
    name: { en: "Ink Orchid", zh: "墨兰" },
    description: {
      en: "Black-violet glass with raised petals and a single drop of gold.",
      zh: "黑紫色玻璃质感，立体花瓣与一滴金色点缀。",
    },
    story: {
      en: "A botanical specimen imagined for the hour after midnight.",
      zh: "为午夜之后想象的一枚植物标本。",
    },
    category: "press-ons",
    collection: "after-dark",
    tags: ["dark", "floral", "3d"],
    price: 64,
    images: [
      nailImage(
        "https://images.unsplash.com/photo-1607779097040-26e80aa78e66",
        "Ink Orchid black floral press-on nails",
        "墨兰黑色花卉穿戴甲",
      ),
    ],
    shapes: ["Stiletto", "Almond"],
    sizes: ["XS", "S", "M", "L", "Custom"],
    finishes: ["High gloss"],
    stock: 11,
    featured: true,
    bestseller: true,
  },
  {
    id: "prd_mercury_tide",
    slug: "mercury-tide",
    name: { en: "Mercury Tide", zh: "水银潮汐" },
    description: {
      en: "Cool blue cat-eye pigment moving beneath a mirrored surface.",
      zh: "冷蓝猫眼光在镜面之下流动。",
    },
    story: {
      en: "A reflective set that changes character with every room.",
      zh: "随光线与空间改变气质的反光甲组。",
    },
    category: "press-ons",
    collection: "moonlit-metal",
    tags: ["blue", "chrome", "cat-eye"],
    price: 56,
    images: [
      nailImage(
        "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b",
        "Mercury Tide blue metallic manicure",
        "水银潮汐蓝色金属美甲",
      ),
    ],
    shapes: ["Almond", "Square"],
    sizes: ["XS", "S", "M", "L", "Custom"],
    finishes: ["Mirror"],
    stock: 15,
    newArrival: true,
  },
  {
    id: "prd_milkglass_bloom",
    slug: "milkglass-bloom",
    name: { en: "Milkglass Bloom", zh: "乳白花影" },
    description: {
      en: "Milky translucent petals, hand-drawn stems, and dew-like crystals.",
      zh: "乳白透明花瓣、手绘枝梗与露珠般水晶。",
    },
    story: {
      en: "Pressed flowers translated into soft, wearable sculpture.",
      zh: "将压花标本转译成柔和可佩戴的雕塑。",
    },
    category: "press-ons",
    collection: "petal-study",
    tags: ["white", "floral", "bridal"],
    price: 62,
    images: [
      nailImage(
        "https://images.unsplash.com/photo-1519014816548-bf5fe059798b",
        "Milkglass Bloom white floral press-on nails",
        "乳白花影白色花卉穿戴甲",
      ),
    ],
    shapes: ["Oval", "Almond"],
    sizes: ["XS", "S", "M", "L", "Custom"],
    finishes: ["Satin", "Gloss"],
    stock: 9,
    featured: true,
  },
  {
    id: "prd_studio_kit",
    slug: "studio-application-kit",
    name: { en: "Studio Application Kit", zh: "工作室佩戴工具包" },
    description: {
      en: "Everything required for a clean fit: tabs, glue, file, buffer, and prep wipe.",
      zh: "贴合佩戴所需全套工具：果冻胶、胶水、甲锉、海绵锉与清洁棉。",
    },
    story: {
      en: "The same considered preparation used at our studio, packed for home.",
      zh: "将工作室级的细致准备装进居家工具包。",
    },
    category: "supplies",
    collection: "studio-essentials",
    tags: ["tools", "care"],
    price: 18,
    images: [
      nailImage(
        "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9",
        "Nail application tools arranged on a tray",
        "托盘中陈列的美甲佩戴工具",
      ),
    ],
    shapes: ["Standard"],
    sizes: ["One size"],
    finishes: ["Studio"],
    stock: 52,
    bestseller: true,
  },
];

export const services: Service[] = [
  {
    slug: "signature-gel",
    name: { en: "Signature Gel", zh: "经典凝胶" },
    description: {
      en: "Detailed cuticle care, structured gel, and a custom one-color finish.",
      zh: "精细甘皮护理、建构凝胶与定制单色效果。",
    },
    price: 68,
    durationMinutes: 75,
    image: nailImage(
      "https://images.unsplash.com/photo-1604654894610-df63bc536371",
      "Signature pink gel manicure",
      "经典粉色凝胶美甲",
    ),
  },
  {
    slug: "atelier-art",
    name: { en: "Atelier Art Session", zh: "工坊艺术定制" },
    description: {
      en: "A collaborative art appointment with hand-painted and dimensional details.",
      zh: "共同创作的艺术美甲预约，包含手绘与立体细节。",
    },
    price: 118,
    durationMinutes: 135,
    image: nailImage(
      "https://images.unsplash.com/photo-1632345031435-8727f6897d53",
      "Detailed sculptural nail art",
      "精细立体美甲艺术",
    ),
  },
  {
    slug: "soft-reset",
    name: { en: "Soft Reset", zh: "温柔焕新" },
    description: {
      en: "Gentle removal, restorative care, shaping, and a sheer treatment.",
      zh: "温和卸甲、修护护理、甲型修整与透明养护。",
    },
    price: 48,
    durationMinutes: 55,
    image: nailImage(
      "https://images.unsplash.com/photo-1519014816548-bf5fe059798b",
      "Natural nail care treatment",
      "自然甲修护护理",
    ),
  },
];

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getCollection(slug: string) {
  return collections.find((collection) => collection.slug === slug);
}

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}
