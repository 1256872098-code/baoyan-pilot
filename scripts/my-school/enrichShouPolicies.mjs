import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dataUrl = new URL("../../public/data/my-school/school-f17pfd.json", import.meta.url);

const colleges = [
  {
    id: "unit-2ab6bc6a61",
    name: "水产与生命学院",
    publishedAt: "2026-01-06",
    url: "https://smxy.shou.edu.cn/2026/0106/c2095a349689/page.htm",
    specialAcademicRequirement:
      "特殊学术专长申请须满足全部基本条件，并以证书排名前 3 的主力成员身份代表学校参加中国国际大学生创新大赛或“挑战杯/创青春”全国竞赛，获得特等奖、一等奖或金奖，同时取得 3 名以上本校相关专业教授联名推荐并参加公开答辩。",
  },
  {
    id: "unit-f18a84b3d2",
    name: "海洋生物资源与管理学院",
    publishedAt: "2026-01-06",
    url: "https://hyxy.shou.edu.cn/2026/0106/c7567a349732/page.htm",
    specialAcademicRequirement:
      "特殊学术专长条件按专业区分：海洋渔业科学与技术、海洋资源与环境须位于专业或方向前 30%，并以第一作者发表 SCI 论文 2 篇或以第一完成人获授权发明专利 2 项；社会工作须 GPA 不低于 3.3，并满足学院办法列明的 SSCI、CSSCI 论文或 A+ 类国家级竞赛条件之一。申请均须 3 名以上教授联名推荐并参加公开答辩。",
  },
  {
    id: "unit-d0037afbb5",
    name: "海洋科学与生态环境学院",
    publishedAt: "2026-01-06",
    url: "https://hkxy.shou.edu.cn/sfzx/2026/0106/c18279a349703/page.htm",
    specialAcademicRequirement:
      "特殊学术专长条件按专业区分：环境科学、环境工程、生态学须位于专业前 50% 且满足学院指定国家级竞赛最高奖、排名第一条件；海洋科学、海洋技术须位于专业或方向前 30%，并以第一作者发表 SCI 论文 2 篇或以第一完成人获授权发明专利 2 项。申请均须 3 名以上教授联名推荐并参加公开答辩。",
  },
  {
    id: "unit-29a6ae362e",
    name: "食品学院",
    publishedAt: "2026-01-06",
    url: "https://spxy.shou.edu.cn/2026/0106/c17577a349706/page.htm",
    specialAcademicRequirement:
      "特殊学术专长申请须 GPA 不低于 3.3，并满足学院办法列明的国家级竞赛一等奖且排名第一，或第一署名单位为学校、本人排名第一的中文卓越期刊或 JCR 一区论文条件之一，同时取得 3 名以上教授联名推荐并参加公开答辩。",
  },
  {
    id: "unit-56716fffbe",
    name: "经济管理学院",
    publishedAt: "2026-01-06",
    url: "https://jmxy.shou.edu.cn/2026/0106/c17373a349684/page.htm",
  },
  {
    id: "unit-88707382a0",
    name: "工程学院",
    publishedAt: "2026-01-06",
    url: "https://gcxy.shou.edu.cn/2026/0106/c11246a349690/page.htm",
    specialAcademicRequirement:
      "特殊学术专长申请须 GPA 不低于 3.00，并满足学院办法列明的国家级竞赛一等奖及以上且排名第一条件，同时取得 3 名以上教授联名推荐并参加公开答辩。",
  },
  {
    id: "unit-3662d2b62d",
    name: "信息学院",
    publishedAt: "2026-01-06",
    url: "https://xxxy.shou.edu.cn/2026/0106/c17512a349679/page.psp",
    specialAcademicRequirement: "信息学院最新公开的 2027 届实施办法未单列特殊学术专长选拔通道。",
  },
  {
    id: "unit-8ce613f3c1",
    name: "外国语学院",
    publishedAt: "2026-01-07",
    url: "https://wyxy.shou.edu.cn/2026/0107/c13444a349748/page.htm",
    languageRequirement:
      "英语专业须通过全国高校英语专业四级；日语专业须通过 JLPT N2 或全国高校日语专业四级；朝鲜语专业须通过 TOPIK 4 或全国高校朝鲜语专业四级。推荐成绩相同时，专业八级通过者优先。",
    specialAcademicRequirement: "外国语学院最新公开的 2027 届实施办法未单列特殊学术专长选拔通道。",
  },
  {
    id: "unit-2e3d32c373",
    name: "爱恩学院",
    publishedAt: "2026-01-06",
    url: "https://ien.shou.edu.cn/2026/0106/c2204a349716/page.htm",
    specialAcademicRequirement: "爱恩学院最新公开的 2027 届实施办法未单列特殊学术专长选拔通道。",
  },
];

const collegeIds = new Set(colleges.map((college) => college.id));

function buildScope(college) {
  return {
    schoolId: "school-f17pfd",
    collegeId: college.id,
    collegeName: college.name,
    majorId: null,
    majorName: null,
    appliesToAllColleges: false,
    appliesToAllMajors: true,
    label: `${college.name}通用`,
  };
}

function buildSource(college) {
  return {
    title: `${college.name}关于推荐优秀应届本科毕业生免试攻读研究生工作的实施办法（2027届适用）`,
    url: college.url,
    sourceType: "policy",
    publishedAt: college.publishedAt,
    sourceOrganization: `上海海洋大学${college.name}`,
    sourceLevel: "official",
    lastCheckedAt: "2026-08-07T00:00:00.000Z",
  };
}

function buildPolicy(college) {
  const source = buildSource(college);
  return {
    scope: buildScope(college),
    year: 2027,
    scopeType: "college",
    collegeName: college.name,
    applicabilityLabel: `${college.name}通用`,
    title: source.title,
    eligibility: {
      studentStatus: [
        {
          text: "纳入国家普通本科招生计划录取、具有校内学籍的应届本科毕业生；不含专升本、第二学士学位学生，且此前未参加过推免环节。",
        },
        {
          text: "坚持德智体美劳全面衡量、以德为先；政治立场坚定，遵纪守法，诚实守信。",
        },
      ],
      courseRequirements: [
        {
          text: "截至推免时完成培养方案规定进度的课程并取得相应学分，必修课及限选课无不及格记录。",
        },
        {
          text: "全学程平均学分绩点不低于 3.00，或平均学分绩点排名位于本专业前 50%（含）。",
        },
      ],
      languageRequirements: [
        {
          text:
            college.languageRequirement ||
            "全国大学英语四级考试成绩达到 425 分（含）以上；修读日语、韩语、法语等公共外语的，按学院办法列明的对应等级执行。",
        },
      ],
      disciplineRequirements: [
        {
          text: "无考试违纪、学术不端记录，无尚未解除的处分；思想品德考核不合格者不予推荐。",
        },
      ],
      otherRequirements: [
        {
          text:
            college.specialAcademicRequirement ||
            "特殊学术专长申请须满足学院文件规定的成果、推荐和答辩条件；各学院认定范围存在差异，请以对应学院原文为准。",
        },
      ],
    },
    materials: [
      {
        text: "按学院当年通知提交推免申请审核表、成绩材料，以及科研创新、全面发展等证明材料。",
      },
    ],
    schedule: [
      {
        text: "具体申报、审核、公示时间由学院在启动当年推免工作时公布。",
      },
    ],
    procedure: [
      {
        text: "学生自愿申报，学院审核申请资格、思想品德、成绩及证明材料，并按推荐成绩排序。",
      },
      {
        text: "学院根据学校分配名额确定推荐和候补名单，经审议、公示后报学校审核。",
      },
    ],
    source,
  };
}

function buildRankingRule(college) {
  return {
    scope: buildScope(college),
    year: 2027,
    collegeName: college.name,
    applicabilityLabel: `${college.name}通用`,
    academicWeight: 0.75,
    researchWeight: 0.15,
    developmentWeight: 0.1,
    formula: "推荐成绩 = 全学程平均学分绩点 × 75% + 科研创新绩点 × 15% + 全面发展绩点 × 10%",
    rankingScope:
      "学院推免工作小组审核并排序，根据学校分配名额确定推荐和候补名单；推荐成绩相等时，按全学程平均学分绩点从高到低排序。",
    rules: [
      "全学程平均学分绩点、科研创新绩点、全面发展绩点的满分均为 4 分。",
      "课程成绩按首次考试成绩计算绩点。",
      "推荐成绩相等时，以全学程平均学分绩点高低排序。",
      "学院自定竞赛目录和特殊学术专长认定条件可能不同，须查看对应学院官方原文。",
    ],
    source: buildSource(college),
  };
}

function buildBonusRules(college) {
  const base = {
    scope: buildScope(college),
    year: 2027,
    collegeName: college.name,
    applicabilityLabel: `${college.name}通用`,
    source: buildSource(college),
  };

  return [
    {
      ...base,
      category: "科研创新",
      items: [
        {
          name: "学术论文与发明专利",
          condition: "本科阶段、代表上海海洋大学取得，且符合学院实施办法认定范围的成果。",
          scoreRule: "符合条件的核心期刊论文、国内发明专利每项最高计 2.4 绩点，具体按成果类别及作者或发明人排序折算。",
          cap: "科研创新绩点满分 4 分；成果认定截止推免当年 8 月 31 日。",
        },
        {
          name: "学科竞赛",
          condition: "参加学校及学院实施办法认定范围内的学科竞赛并获奖。",
          scoreRule: "按赛事类别、级别、奖项和团队排序计分，单项最高计 2.4 绩点。",
          cap: "各学院自定赛事目录及非 A、B 类赛事上限不同，具体以对应学院官方原文为准；同一项目同一年度就高计一次。",
        },
      ],
    },
    {
      ...base,
      category: "全面发展",
      items: [
        {
          name: "服兵役、荣誉及文体志愿实践",
          condition: "符合实施办法认定范围的入伍服兵役、校级荣誉、体育、美育或志愿服务经历。",
          scoreRule: "服满兵役计 1.2 绩点，服役荣誉最高计 2.4；校级荣誉一般计 0.2 或 0.3；体育、美育单项最高计 2.4；志愿服务荣誉国家级计 0.5、省市级计 0.2。",
          cap: "全面发展绩点满分 4 分；同一学年同类荣誉按文件规定就高计分。",
        },
        {
          name: "国际组织实习",
          condition: "由学校选派至国际组织实习 3 个月及以上，并按期完成实习任务。",
          scoreRule: "境外实习每次计 1.0 绩点，境内或线上实习每次计 0.5 绩点。",
          cap: "须通过学院材料审核。",
        },
      ],
    },
  ];
}

function isLatestForCoveredCollege(item) {
  return Number(item?.year) === 2027 && collegeIds.has(item?.scope?.collegeId);
}

const data = JSON.parse(await readFile(dataUrl, "utf8"));
const economicManagementId = "unit-56716fffbe";

const existingEconomicPolicy = (data.policies || []).find(
  (item) => item?.scope?.collegeId === economicManagementId && Number(item?.year) === 2027,
);
const existingEconomicRanking = (data.rankingRules || []).find(
  (item) => item?.scope?.collegeId === economicManagementId && Number(item?.year) === 2027,
);
const existingEconomicBonuses = (data.bonusRules || []).filter(
  (item) => item?.scope?.collegeId === economicManagementId && Number(item?.year) === 2027,
);

const latestPolicies = colleges.map((college) =>
  college.id === economicManagementId && existingEconomicPolicy
    ? existingEconomicPolicy
    : buildPolicy(college),
);
const latestRankingRules = colleges.map((college) =>
  college.id === economicManagementId && existingEconomicRanking
    ? existingEconomicRanking
    : buildRankingRule(college),
);
const latestBonusRules = colleges.flatMap((college) =>
  college.id === economicManagementId && existingEconomicBonuses.length
    ? existingEconomicBonuses
    : buildBonusRules(college),
);

data.policies = [...(data.policies || []).filter((item) => !isLatestForCoveredCollege(item)), ...latestPolicies];
data.rankingRules = [
  ...(data.rankingRules || []).filter((item) => !isLatestForCoveredCollege(item)),
  ...latestRankingRules,
];
data.bonusRules = [
  ...(data.bonusRules || []).filter((item) => !isLatestForCoveredCollege(item)),
  ...latestBonusRules,
];
data.lastUpdatedAt = "2026-08-07T00:00:00.000Z";

await writeFile(dataUrl, `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.log(
  `已补齐 ${colleges.length} 个学院：${latestPolicies.length} 份 2027 届政策、${latestRankingRules.length} 份排名规则、${latestBonusRules.length} 组加分规则。`,
);
console.log(`写入：${fileURLToPath(dataUrl)}`);
