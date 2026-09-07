import type { LocalizedText } from "@/types/catalog";

export type ContentSection = {
  title: LocalizedText;
  body: LocalizedText[];
  list?: LocalizedText[];
};

export type ContentPage = {
  eyebrow: LocalizedText;
  title: LocalizedText;
  intro: LocalizedText;
  sections: ContentSection[];
  form?: "contact" | "wholesale";
};

export const contentPages: Record<string, ContentPage> = {
  about: {
    eyebrow: { en: "Our point of view", zh: "我们的视角" },
    title: { en: "Hands tell stories.", zh: "双手会讲故事。" },
    intro: {
      en: "Lunaria is an independent nail atelier built around expressive design, healthy technique, and the pleasure of objects made slowly.",
      zh: "Lunaria 是一家独立美甲工坊，专注富有表达力的设计、健康技法，以及慢工制作带来的愉悦。",
    },
    sections: [
      {
        title: { en: "The atelier", zh: "工坊" },
        body: [
          {
            en: "Every press-on set begins with a drawing and is finished by hand in our Chicago studio. Small runs let us experiment while keeping the work personal.",
            zh: "每套穿戴甲都始于一张草图，并在芝加哥工坊手工完成。小批量制作让我们保持实验性，也让作品更具个人温度。",
          },
        ],
      },
      {
        title: { en: "Materials with intention", zh: "用心选择材料" },
        body: [
          {
            en: "We select salon-grade gels, reusable full-cover tips, and packaging designed to protect each set without unnecessary bulk.",
            zh: "我们选用沙龙级凝胶、可重复使用的全贴甲片，以及能够妥善保护作品且不过度包装的材料。",
          },
        ],
      },
      {
        title: { en: "Beyond the trend cycle", zh: "不止于潮流" },
        body: [
          {
            en: "Our references move between jewelry, botanical archives, architecture, and the night sky. The goal is not novelty for its own sake, but work you want to revisit.",
            zh: "我们的灵感来自珠宝、植物档案、建筑与夜空。目标并非单纯追新，而是创作值得反复佩戴的作品。",
          },
        ],
      },
    ],
  },
  contact: {
    eyebrow: { en: "Say hello", zh: "欢迎联系" },
    title: { en: "The studio door is open.", zh: "工坊的大门为你敞开。" },
    intro: {
      en: "Questions about sizing, an order, or an appointment? Send a note and our small team will reply within two business days.",
      zh: "对尺寸、订单或预约有疑问？请留言，我们的小团队会在两个工作日内回复。",
    },
    sections: [
      {
        title: { en: "Studio visits", zh: "到访工坊" },
        body: [
          {
            en: "Visits are by appointment only. Pickup windows can be selected during checkout.",
            zh: "工坊仅接受预约到访。结账时可选择自取时间。",
          },
        ],
      },
    ],
    form: "contact",
  },
  faq: {
    eyebrow: { en: "Useful answers", zh: "常见问题" },
    title: { en: "Ask us anything.", zh: "你想知道的，都可以问。" },
    intro: {
      en: "The practical details behind made-to-measure nail objects and studio appointments.",
      zh: "关于量身定制穿戴甲与工坊预约的实用信息。",
    },
    sections: [
      {
        title: { en: "How long will my set last?", zh: "一套甲可以佩戴多久？" },
        body: [
          {
            en: "Adhesive tabs are ideal for one to three days. With careful preparation and nail glue, many clients wear a set for one to two weeks. Results vary by lifestyle and application.",
            zh: "果冻胶适合佩戴一至三天。认真准备并使用胶水后，许多客人可佩戴一至两周；实际时长会因生活方式与佩戴方法而异。",
          },
        ],
      },
      {
        title: { en: "Can I reuse my nails?", zh: "甲片可以重复使用吗？" },
        body: [
          {
            en: "Yes. Remove them gently, clean residual adhesive, and return them to their numbered tray.",
            zh: "可以。请温和卸除、清理残胶，并按编号放回收纳盒。",
          },
        ],
      },
      {
        title: {
          en: "What if standard sizing does not fit?",
          zh: "标准尺寸不合适怎么办？",
        },
        body: [
          {
            en: "Choose Custom and send the measurements requested in our sizing guide. We recommend ordering a sizing kit before intricate custom work.",
            zh: "请选择定制尺寸，并按尺寸指南提交测量数据。复杂定制作品建议先购买试戴尺寸包。",
          },
        ],
      },
      {
        title: {
          en: "Do I need an account to book?",
          zh: "预约需要注册账户吗？",
        },
        body: [
          {
            en: "No. Guest booking, checkout, and order tracking are always available.",
            zh: "不需要。访客始终可以直接预约、结账与查询订单。",
          },
        ],
      },
    ],
  },
  wholesale: {
    eyebrow: { en: "For thoughtful retailers", zh: "面向精品零售伙伴" },
    title: {
      en: "Bring Lunaria to your space.",
      zh: "让 Lunaria 进入你的空间。",
    },
    intro: {
      en: "We partner with independent salons, concept stores, and beauty retailers who care about original design and considered presentation.",
      zh: "我们与重视原创设计与精致陈列的独立沙龙、概念店和美妆零售商合作。",
    },
    sections: [
      {
        title: { en: "The programme", zh: "合作计划" },
        body: [
          {
            en: "Opening orders begin at 24 sets, with tiered pricing, merchandising guidance, bilingual care cards, and tracked shipping.",
            zh: "首单 24 套起，提供阶梯价格、陈列建议、双语护理卡与可追踪配送。",
          },
        ],
        list: [
          { en: "Curated seasonal assortments", zh: "精选季节组合" },
          {
            en: "Low minimums for independent shops",
            zh: "适合独立店铺的低起订量",
          },
          {
            en: "Private-label consultation for larger runs",
            zh: "大批量订单可咨询自有品牌合作",
          },
        ],
      },
    ],
    form: "wholesale",
  },
  "guides/sizing": {
    eyebrow: { en: "Fit comes first", zh: "贴合，从尺寸开始" },
    title: {
      en: "Measure once. Wear beautifully.",
      zh: "准确测量，自在佩戴。",
    },
    intro: {
      en: "A precise fit protects your natural nails, looks more seamless, and helps every set last longer.",
      zh: "准确贴合能够保护自然甲、呈现更无缝的效果，并延长每套甲片的使用寿命。",
    },
    sections: [
      {
        title: { en: "Measure with transparent tape", zh: "使用透明胶带测量" },
        body: [
          {
            en: "Place tape across the widest point of each bare nail. Mark both sidewalls, lay the tape flat, and record the distance in millimeters.",
            zh: "将透明胶带横贴在裸甲最宽处，标记两侧边缘，取下铺平后记录毫米数。",
          },
        ],
        list: [
          {
            en: "Measure both hands—they are often different.",
            zh: "双手都要测量，尺寸常有差异。",
          },
          {
            en: "Round up when between sizes.",
            zh: "介于两个尺寸时，请选择较大尺寸。",
          },
          {
            en: "Measure on bare nails without product.",
            zh: "请在无甲油或凝胶的裸甲上测量。",
          },
        ],
      },
      {
        title: { en: "Standard set guide", zh: "标准尺寸参考" },
        body: [
          {
            en: "XS: 14, 10, 11, 10, 7 mm · S: 15, 11, 12, 10, 8 mm · M: 16, 12, 13, 11, 9 mm · L: 17, 13, 14, 12, 10 mm.",
            zh: "XS：14、10、11、10、7 毫米 · S：15、11、12、10、8 毫米 · M：16、12、13、11、9 毫米 · L：17、13、14、12、10 毫米。",
          },
        ],
      },
    ],
  },
  "guides/application-removal": {
    eyebrow: { en: "Wear well", zh: "正确佩戴" },
    title: {
      en: "A clean beginning. A gentle ending.",
      zh: "洁净开始，温和结束。",
    },
    intro: {
      en: "Preparation makes the difference. Never force a press-on nail during removal.",
      zh: "充分准备决定佩戴效果。卸除时请勿强行剥离甲片。",
    },
    sections: [
      {
        title: { en: "Application", zh: "佩戴步骤" },
        body: [
          {
            en: "Wash and dry hands, push back cuticles, lightly buff shine, remove dust, and wipe every nail with alcohol. Apply tabs for short wear or a thin, even layer of glue for longer wear.",
            zh: "清洁并擦干双手，推起甘皮，轻磨甲面光泽，除尘后用酒精棉擦拭。短期佩戴使用果冻胶，长期佩戴可均匀薄涂胶水。",
          },
        ],
        list: [
          {
            en: "Avoid water for two hours after applying.",
            zh: "佩戴后两小时内避免接触水。",
          },
          {
            en: "Press each nail firmly for 30 seconds.",
            zh: "每枚甲片按压 30 秒。",
          },
          {
            en: "Do not apply to irritated or damaged nails.",
            zh: "请勿在受刺激或受损甲面上使用。",
          },
        ],
      },
      {
        title: { en: "Removal", zh: "卸除步骤" },
        body: [
          {
            en: "Soak in warm soapy water with a little oil for 10–15 minutes. Work around the edge with the wood stick, re-soaking whenever there is resistance.",
            zh: "在加入少量油的温肥皂水中浸泡 10–15 分钟。用木棒沿边缘轻推，遇到阻力时继续浸泡。",
          },
        ],
      },
    ],
  },
  "policies/shipping": {
    eyebrow: { en: "Delivery", zh: "配送" },
    title: { en: "Shipping policy", zh: "配送政策" },
    intro: {
      en: "Transparent timing for objects that are finished by hand.",
      zh: "手工完成的作品，也应有透明清晰的配送时间。",
    },
    sections: [
      {
        title: { en: "Processing", zh: "制作时间" },
        body: [
          {
            en: "Made-to-order sets usually leave the studio within 5–8 business days. Ready-to-ship supplies leave within 2 business days. Mixed orders ship together unless arranged otherwise.",
            zh: "按需制作甲组通常在 5–8 个工作日内寄出。现货工具会在 2 个工作日内寄出。混合订单默认合并发货。",
          },
        ],
      },
      {
        title: { en: "Transit and duties", zh: "运输与关税" },
        body: [
          {
            en: "US delivery typically takes 4–7 business days after dispatch. International transit varies by destination. Import taxes and duties are the recipient’s responsibility where required.",
            zh: "美国境内寄出后通常需 4–7 个工作日。国际运输时间因目的地而异；如产生进口税费，由收件人承担。",
          },
        ],
      },
    ],
  },
  "policies/returns": {
    eyebrow: { en: "Fair resolutions", zh: "妥善解决" },
    title: { en: "Returns and refunds", zh: "退换与退款政策" },
    intro: {
      en: "Custom-sized and hygienic products need special handling, but seller errors and damaged arrivals will always be addressed.",
      zh: "定制尺寸与卫生类商品需特殊处理，但因商家错误或运输损坏产生的问题，我们会负责解决。",
    },
    sections: [
      {
        title: { en: "Change of mind", zh: "非质量原因" },
        body: [
          {
            en: "For hygiene reasons, opened nail sets and custom-sized work cannot be returned for preference or sizing changes. Unopened standard supplies may be returned within 14 days; return shipping is deducted from the refund.",
            zh: "出于卫生原因，已开封甲组与定制尺寸作品不接受因偏好或尺寸变更而退货。未开封标准工具可在 14 天内退回，退款中将扣除退货运费。",
          },
        ],
      },
      {
        title: { en: "Damage or studio error", zh: "损坏或工坊错误" },
        body: [
          {
            en: "Contact us within 72 hours of delivery with clear photographs. Confirmed damage, incorrect items, or production errors are eligible for a replacement, remake, or refund as required by applicable law.",
            zh: "请在收货后 72 小时内联系我们并提供清晰照片。确认存在运输损坏、错发或制作错误时，可依法获得换货、重制或退款。",
          },
        ],
      },
    ],
  },
  "policies/privacy": {
    eyebrow: { en: "Your information", zh: "你的信息" },
    title: { en: "Privacy policy", zh: "隐私政策" },
    intro: {
      en: "We collect only what is needed to fulfil orders, manage appointments, support customers, and improve the atelier.",
      zh: "我们仅收集履行订单、管理预约、提供客户支持与改进工坊所需的信息。",
    },
    sections: [
      {
        title: { en: "What we collect", zh: "我们收集什么" },
        body: [
          {
            en: "Contact, delivery, order, payment-status, appointment, account, and support information. Card details are handled by Stripe and are never stored on our servers.",
            zh: "包括联系、配送、订单、支付状态、预约、账户与客服信息。银行卡信息由 Stripe 处理，我们的服务器不会存储。",
          },
        ],
      },
      {
        title: { en: "Your choices", zh: "你的选择" },
        body: [
          {
            en: "You may request access, correction, deletion, or export of eligible personal information by contacting the studio. Marketing messages always include an unsubscribe method.",
            zh: "你可以联系工坊，请求访问、更正、删除或导出符合条件的个人信息。营销邮件始终提供退订方式。",
          },
        ],
      },
    ],
  },
  "policies/terms": {
    eyebrow: { en: "Studio agreement", zh: "工坊协议" },
    title: { en: "Terms and conditions", zh: "条款与条件" },
    intro: {
      en: "These terms explain how orders, appointments, and the website operate.",
      zh: "本条款说明订单、预约与网站的运作方式。",
    },
    sections: [
      {
        title: { en: "Orders", zh: "订单" },
        body: [
          {
            en: "An order is accepted after payment succeeds and inventory is confirmed. We may cancel and refund orders affected by pricing errors, unavailable materials, suspected fraud, or destinations we cannot safely serve.",
            zh: "订单在支付成功并确认库存后成立。如遇价格错误、材料缺货、疑似欺诈或无法安全配送的目的地，我们可取消订单并退款。",
          },
        ],
      },
      {
        title: { en: "Appointments", zh: "预约" },
        body: [
          {
            en: "Changes and cancellations are accepted until 24 hours before the appointment. Repeated no-shows may require a non-refundable deposit for future bookings. Mandatory consumer rights remain unaffected.",
            zh: "预约开始前 24 小时可更改或取消。多次未到店的客人后续预约可能需要支付不可退还的订金。法定消费者权益不受影响。",
          },
        ],
      },
    ],
  },
};
