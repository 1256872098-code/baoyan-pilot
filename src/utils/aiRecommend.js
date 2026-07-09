export const backgroundFields = [
  { key: "grade", label: "年级", hint: "例如：大三上" },
  { key: "major", label: "专业", hint: "例如：计算机科学与技术" },
  { key: "schoolTier", label: "学校层次", hint: "例如：211/双一流、普通本科" },
  { key: "academic", label: "绩点或排名", hint: "例如：GPA 3.72 / 前 10%" },
  { key: "english", label: "英语成绩", hint: "例如：CET-6 548" },
  { key: "research", label: "科研经历", hint: "项目、论文、实验室经历" },
  { key: "competition", label: "竞赛经历", hint: "竞赛名称、奖项、负责内容" },
  { key: "targetDirection", label: "目标专业方向", hint: "例如：人工智能、金融、法学" },
  { key: "city", label: "意向城市", hint: "例如：北京、上海、长三角" },
  { key: "risk", label: "风险偏好", hint: "例如：稳妥、均衡、冲刺" },
];

const fieldMatchers = {
  grade: /大[一二三四]|本科[一二三四]|20\d{2}\s*级|junior|senior/i,
  major:
    /专业|计算机|软件|人工智能|自动化|电子|通信|金融|经济|会计|法学|新闻|医学|材料|数学|统计|管理|生物|临床|药学|机械|土木/i,
  schoolTier: /学校层次|院校层次|985|211|双一流|双非|普通本科|一本|特色强校/i,
  academic: /绩点|gpa|GPA|均分|排名|前\s*\d+|top|\/|[345]\.\d/i,
  english: /英语|六级|四级|CET|雅思|托福|IELTS|TOEFL|4\d{2}|5\d{2}|6\d{2}/i,
  research: /科研|课题|论文|大创|实验室|项目|专利|导师|研究/i,
  competition: /竞赛|比赛|奖|蓝桥|数学建模|挑战杯|互联网\+|ACM|ICPC|奖项/i,
  targetDirection: /目标|方向|申请|保研|人工智能|计算机|金融|法学|新闻|材料|医学|管理|控制|通信|数据|统计|NLP|CV/i,
  city: /北京|上海|广州|深圳|杭州|南京|武汉|成都|西安|天津|重庆|苏州|长三角|珠三角|华东|华北|华南|不限|城市|地区/i,
  risk: /风险|冲刺|稳妥|保守|激进|均衡|稳一点|搏一搏|安全|保底/i,
};

const directionCatalog = {
  computer: {
    label: "计算机与人工智能",
    stretch: [
      ["清华大学", "计算机、人工智能相关项目竞争强，适合作为高难度冲刺样本，前提是科研主线和面试表达继续打磨。"],
      ["上海交通大学", "工程实践和科研匹配度要求高，如果项目经历能讲清问题、方法和结果，可以作为冲刺梯度。"],
      ["浙江大学", "学科覆盖广，AI、软件、数据方向机会较多，适合履历均衡且目标方向明确的申请者。"],
    ],
    match: [
      ["南京大学", "重视专业基础和持续学习轨迹，适合成绩稳定、科研仍在提升中的申请者重点匹配。"],
      ["北京邮电大学", "信息通信和计算机方向辨识度强，对项目实践较友好，适合作为重点匹配院校。"],
      ["华东师范大学", "计算机、软件与数据方向资源较稳定，适合希望兼顾城市和方向匹配的同学。"],
    ],
    safe: [
      ["南京邮电大学", "信息类特色鲜明，适合作为同方向稳妥备选，便于保障申请梯度完整。"],
      ["杭州电子科技大学", "计算机和电子信息方向实践导向明显，适合项目经历较强的稳妥配置。"],
      ["深圳大学", "区位和产业资源较好，适合希望保留华南或深圳机会的申请者纳入备选。"],
    ],
  },
  finance: {
    label: "金融与管理",
    stretch: [
      ["北京大学", "经管相关项目竞争密集，适合作为高冲刺样本，需要突出数理基础、实习和研究兴趣。"],
      ["复旦大学", "区位和专业资源突出，适合有清晰金融、管理或数据分析主线的申请者冲刺。"],
      ["上海交通大学", "偏好综合能力和实践经历，若实习、竞赛或研究案例完整，可纳入冲刺梯度。"],
    ],
    match: [
      ["中央财经大学", "财经特色强，适合金融、会计、管理方向目标明确且实习经历可讲清的申请者。"],
      ["对外经济贸易大学", "国际化和经管方向认可度高，英语与商科表达优势可以转化为匹配点。"],
      ["中南财经政法大学", "财经与法商交叉资源较好，适合作为区域和专业匹配兼顾的选择。"],
    ],
    safe: [
      ["东北财经大学", "财经类特色明显，适合作为稳妥梯度中保留专业匹配度的选择。"],
      ["江西财经大学", "财经方向培养体系成熟，适合补足稳妥院校池。"],
      ["首都经济贸易大学", "北京区位明显，适合希望保留北京机会的稳妥配置。"],
    ],
  },
  law: {
    label: "法学与公共管理",
    stretch: [
      ["北京大学", "法学与公共管理方向竞争强，适合作为表达能力、阅读积累和专业主线都较强时的冲刺样本。"],
      ["中国人民大学", "法学、公共管理和社科方向实力突出，需要突出理论基础和案例分析能力。"],
      ["复旦大学", "综合平台和城市资源突出，适合有清晰议题兴趣和跨学科背景的申请者冲刺。"],
    ],
    match: [
      ["中国政法大学", "法学特色鲜明，案例分析和专业表达要求高，适合作为重点匹配院校。"],
      ["武汉大学", "法学、公共管理等方向基础强，适合成绩和表达较均衡的申请者。"],
      ["华东政法大学", "法学方向区位和行业联系较好，适合希望留在华东发展的同学。"],
    ],
    safe: [
      ["西南政法大学", "法学特色强，适合作为稳妥梯度中保持专业质量的选择。"],
      ["上海政法学院", "区位明确，适合补充华东地区稳妥备选。"],
      ["南京师范大学", "法学与公共管理方向可作为区域型稳妥选择。"],
    ],
  },
  default: {
    label: "目标专业方向",
    stretch: [
      ["北京大学", "综合平台强，适合作为高竞争冲刺样本，但需要严格核对目标学院和专业方向。"],
      ["复旦大学", "综合学科和城市资源突出，适合方向清晰、材料表达成熟的申请者冲刺。"],
      ["浙江大学", "学科覆盖广，适合跨方向资源匹配和综合型申请路径。"],
    ],
    match: [
      ["南京大学", "学术训练和专业基础要求稳定，适合纳入重点匹配梯度。"],
      ["武汉大学", "综合实力和优势学科较均衡，适合作为匹配院校样本。"],
      ["中山大学", "华南地区综合平台强，适合希望兼顾城市与学科资源的申请者。"],
    ],
    safe: [
      ["苏州大学", "区域资源和学科覆盖较好，适合作为稳妥梯度中的综合选择。"],
      ["暨南大学", "华南区位明显，适合保留区域机会。"],
      ["上海大学", "城市资源较好，适合作为稳妥备选之一。"],
    ],
  },
};

function detectFields(text) {
  const detected = backgroundFields.filter((field) => fieldMatchers[field.key]?.test(text));
  const missing = backgroundFields.filter((field) => !fieldMatchers[field.key]?.test(text));

  return {
    detected,
    missing,
    score: detected.length,
    percent: Math.round((detected.length / backgroundFields.length) * 100),
  };
}

function matchOne(text, regex, fallback = "未明确") {
  const match = text.match(regex);
  return match ? match[0].replace(/\s+/g, " ").trim() : fallback;
}

function matchMany(text, regex, fallback = "未明确") {
  const matches = text.match(regex);
  return matches ? Array.from(new Set(matches)).join("、") : fallback;
}

function inferDirection(text) {
  if (/计算机|软件|人工智能|数据|通信|电子|自动化|NLP|CV/i.test(text)) return "computer";
  if (/金融|经济|会计|管理|商科|经管/i.test(text)) return "finance";
  if (/法学|法律|公共管理|行政管理|社科/i.test(text)) return "law";
  return "default";
}

function inferRisk(text) {
  if (/激进|冲刺|搏一搏/i.test(text)) return "aggressive";
  if (/稳妥|保守|安全|稳一点|保底/i.test(text)) return "conservative";
  return "balanced";
}

function buildPath(riskType, directionLabel) {
  if (riskType === "aggressive") {
    return [
      `采用“少量高冲刺 + 多所强匹配 + 必要稳妥”的组合，${directionLabel}方向不要只押注顶尖项目。`,
      "冲刺院校建议控制在 20%-30% 左右，把主要精力放在最契合导师、项目和城市的申请上。",
      "提前准备预推免和九月推免备选，避免夏令营结果波动后没有补位方案。",
    ];
  }

  if (riskType === "conservative") {
    return [
      `先锁定${directionLabel}方向的匹配和稳妥院校，确保申请池覆盖不同地区、不同项目类型。`,
      "冲刺院校保留 1-2 个即可，更多精力放在材料完成度、面试稳定性和信息核验上。",
      "优先关注往年报名门槛、材料要求和导师方向，避免目标过散导致准备质量下降。",
    ];
  }

  return [
    `建议使用“冲刺、匹配、稳妥”三档并行的平衡路径，围绕${directionLabel}方向建立 8-12 所目标池。`,
    "每个梯度都准备 2-4 所院校，按照官网通知时间滚动更新申请清单。",
    "材料主线围绕成绩、科研/竞赛、目标方向和城市偏好展开，减少无关经历堆砌。",
  ];
}

function toSchoolItems(items) {
  return items.map(([name, reason]) => ({ name, reason }));
}

export function analyzeRecommendBackground(text) {
  return detectFields(text);
}

export function createMockRecommendReply(previousMessages, userInput) {
  const allUserText = [...previousMessages.filter((message) => message.role === "user").map((message) => message.content), userInput].join("\n");
  const coverage = detectFields(allUserText);

  if (coverage.score < 7) {
    const missingLabels = coverage.missing.slice(0, 5).map((field) => field.label);

    return {
      kind: "followup",
      content: `我先不直接给院校结论。当前信息完整度约 ${coverage.percent}%，还不足以做梯度推荐。请继续补充：${missingLabels.join("、")}。`,
      missingFields: coverage.missing.slice(0, 6),
    };
  }

  const directionKey = inferDirection(allUserText);
  const catalog = directionCatalog[directionKey];
  const riskType = inferRisk(allUserText);

  return {
    kind: "recommendation",
    content: "根据你目前提供的信息，我先给出一版模拟院校梯度建议。",
    recommendation: {
      profile: [
        { label: "年级", value: matchOne(allUserText, /大[一二三四][上下]?|本科[一二三四]|20\d{2}\s*级/i) },
        {
          label: "专业与方向",
          value: `${matchOne(allUserText, /计算机|软件|人工智能|自动化|电子|通信|金融|经济|会计|法学|新闻|医学|材料|数学|统计|管理|生物|临床|药学|机械|土木/i)} / ${catalog.label}`,
        },
        { label: "学校层次", value: matchOne(allUserText, /顶尖985|985|211|双一流|双非|普通本科|一本|特色强校/i) },
        { label: "成绩基础", value: matchOne(allUserText, /(GPA|gpa|绩点|均分|排名|前)\s*[:：]?\s*[\w.%/／+\-\s]+/i, "已提供成绩或排名信息") },
        { label: "英语成绩", value: matchOne(allUserText, /(CET[-\s]?[46]|四级|六级|雅思|托福|IELTS|TOEFL)\s*[:：]?\s*\d{0,3}(\.\d)?/i, "已提供英语信息") },
        { label: "经历亮点", value: coverage.detected.some((field) => field.key === "research") ? "已提供科研/项目经历，可继续提炼问题、方法和成果。" : "科研经历仍需补充。" },
        { label: "竞赛与实践", value: coverage.detected.some((field) => field.key === "competition") ? "已提供竞赛或奖项信息，适合补充材料亮点。" : "竞赛经历仍需补充。" },
        { label: "意向地区", value: matchMany(allUserText, /北京|上海|广州|深圳|杭州|南京|武汉|成都|西安|天津|重庆|苏州|长三角|珠三角|华东|华北|华南|不限/g) },
      ],
      path: buildPath(riskType, catalog.label),
      groups: [
        { title: "冲刺院校", tone: "blue", items: toSchoolItems(catalog.stretch) },
        { title: "匹配院校", tone: "teal", items: toSchoolItems(catalog.match) },
        { title: "稳妥院校", tone: "amber", items: toSchoolItems(catalog.safe) },
      ],
      nextSteps: [
        "把目标院校整理成表格，字段包括学院、方向、导师、申请类型、材料要求、截止时间。",
        "将科研或竞赛经历压缩成 90 秒介绍和 5 分钟追问版，提前准备可量化成果。",
        "优先核对近两年夏令营、预推免和九月推免通知，动态调整院校梯度。",
      ],
      risks: [
        "推荐结果仅供规划参考，具体以学校官网最新通知为准。",
        "本助手不会承诺保研成功，也不能给出绝对录取判断；实际结果会受到名额、政策、材料真实性、面试表现和竞争环境影响。",
        "示例院校用于帮助建立梯度思路，不代表对应学院当年一定开放相关项目或适合所有细分方向。",
      ],
    },
  };
}
