import { sha256, shortEvidence } from "../common.mjs";

function makeSource(policySource) {
  return {
    title: policySource.title || policySource.name || "经济管理学院关于推荐优秀应届本科毕业生免试攻读研究生工作的实施办法",
    url: policySource.url,
    sourceType: "policy",
    publishedAt: policySource.publishedAt || null,
    sourceOrganization: policySource.sourceOrganization || "上海海洋大学经济管理学院",
    sourceLevel: "official",
    contentHash: sha256(policySource.text || ""),
    lastCheckedAt: new Date().toISOString(),
  };
}

function makeScope({ schoolId, collegeId }) {
  return {
    schoolId,
    collegeId,
    collegeName: "经济管理学院",
    majorId: null,
    majorName: null,
    appliesToAllColleges: false,
    appliesToAllMajors: true,
    label: "经济管理学院通用",
  };
}

function hasAll(text, words) {
  return words.every((word) => text.includes(word));
}

function normalizePolicyText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildPolicy({ source, scope }) {
  return {
    scope,
    year: 2026,
    scopeType: "college",
    collegeName: "经济管理学院",
    applicabilityLabel: "经济管理学院通用",
    title: source.title,
    eligibility: {
      studentStatus: [
        { text: "纳入国家普通本科招生计划（不含专升本、第二学士学位）录取，具备校内学籍，且未曾参与过推免环节的应届毕业生。" },
        { text: "具有高尚的爱国主义情操和集体主义精神，政治立场坚定，社会责任感强，遵纪守法，德才兼备。" },
      ],
      courseRequirements: [
        { text: "截至推免时，修完本专业培养方案中规定进度的课程，并取得相应学分；必修及限选课无不及格。" },
      ],
      disciplineRequirements: [
        { text: "未受过违纪违规处分，无剽窃他人学术成果记录。" },
      ],
      languageRequirements: [
        { text: "全国大学英语四级考试成绩 425 分（含）以上；选修日语、韩语、法语等公共外语课程的，按文件列明的对应等级要求执行。" },
      ],
      healthRequirements: [
        { text: "身心健康，符合规定的体质健康标准。" },
      ],
      otherRequirements: [
        { text: "有浓厚的学术研究兴趣，有较强的科学精神、协作精神、创新精神、创业意识和创新创业能力。" },
        { text: "特殊学术专长学生可不受学院综合排名限制，但占用学院推免名额；会计学等专业要求前三学年平均学分绩点不低于专业排名前 50%，并满足文件列明的国家级学科竞赛一等奖及以上且排名第一等条件。" },
      ],
    },
    materials: [
      { text: "填写《上海海洋大学推荐免试攻读硕士学位研究生申请审核表》。" },
      { text: "按学院通知提交相应证明材料；特殊学术专长申请还需提交申报材料并参加学院组织的材料审查和学术报告答辩。" },
    ],
    schedule: [
      { text: "具体工作时间节点根据上级要求，由经济管理学院在启动当年推免工作时公布。" },
    ],
    procedure: [
      { text: "学院公布院级推荐办法后，学生自愿申报并按时提交申请材料。" },
      { text: "学院推免生推荐工作小组对思想品德、成绩、奖惩情况等进行审核、排序，并根据分配名额确定推免生名单和候补名单。" },
      { text: "名单经学院党政联席会审核后报学校推免生遴选工作领导小组秘书处，学校审定后进行公示并由教务处上传至全国推免服务系统。" },
    ],
    source,
  };
}

function buildRankingRule({ source, scope }) {
  return {
    scope,
    year: 2026,
    collegeName: "经济管理学院",
    applicabilityLabel: "经济管理学院通用",
    academicWeight: 0.75,
    bonusWeight: 0.25,
    formula: "推荐成绩 = 入学至推免时的全学程平均学分绩点 × 0.75 + 加分绩点 × 0.25",
    rankingScope: "学院推免生推荐工作小组审核、排序，并根据学校分配名额确定推免生名单和候补名单；推荐成绩相等时，以全学程平均学分绩点高低排序。",
    rules: [
      "全学程平均学分绩点、加分绩点满分均为 4 分。",
      "推荐成绩按首次成绩计算绩点。",
      "如推荐成绩相等，以全学程平均学分绩点高低排序。",
      "特殊学术专长学生可不受学院综合排名限制，但仍占用学院推免名额，并需通过材料审查和学术报告答辩。",
    ],
    source,
  };
}

function buildBonusRules({ source, scope }) {
  return [
    {
      scope,
      year: 2026,
      collegeName: "经济管理学院",
      applicabilityLabel: "经济管理学院通用",
      category: "入伍服兵役",
      items: [
        {
          name: "服兵役及服役期间荣誉",
          condition: "已服满兵役；服役期间荣立三等功、被评为“四有优秀士兵”等按文件计分。",
          scoreRule: "荣立三等功计 2.4 绩点；“四有优秀士兵”二次计 1.8 绩点，一次计 1.4 绩点；已服满兵役参加推免计 1.2 绩点。",
          cap: "按学院实施办法附件1执行。",
          organization: "上海海洋大学经济管理学院",
        },
      ],
      source,
    },
    {
      scope,
      year: 2026,
      collegeName: "经济管理学院",
      applicabilityLabel: "经济管理学院通用",
      category: "荣誉称号",
      items: [
        {
          name: "校级荣誉称号",
          condition: "本科阶段获得学校文件列明的校级荣誉称号。",
          scoreRule: "校优秀党员、校优秀党务工作者、校优秀团员、校优秀团干部、校优秀学生标兵、校优秀学生干部等每项计 0.3 绩点；校优秀学生、校社会工作积极分子、校大学生艺术团优秀团员等每项计 0.2 绩点。",
          cap: "同一学年的同一类奖项就高计算一次。",
          organization: "上海海洋大学经济管理学院",
        },
      ],
      source,
    },
    {
      scope,
      year: 2026,
      collegeName: "经济管理学院",
      applicabilityLabel: "经济管理学院通用",
      category: "科研成果",
      items: [
        {
          name: "论文与发明专利",
          condition: "成果须与专业相关，第一署名单位为上海海洋大学；论文、专利作者顺序及适用专业按附件表格执行。",
          scoreRule: "国内外核心期刊相关学术论文、国内发明专利每项最高计 2.4 绩点；不同收录类型、作者顺序对应分值按附表1执行。",
          cap: "申请人只能有一次以非第一作者成果加分，且该成果的第一作者应为本校相关学科（专业）的师生。",
          organization: "上海海洋大学经济管理学院",
        },
      ],
      source,
    },
    {
      scope,
      year: 2026,
      collegeName: "经济管理学院",
      applicabilityLabel: "经济管理学院通用",
      category: "学科竞赛",
      items: [
        {
          name: "学校认定 A（含 A+）、B 类赛事和学院认定 C 类赛事",
          condition: "限代表上海海洋大学获得的本科阶段荣誉和成果；A（含 A+）、B 类赛事计前 5 名，学院认定 C 类赛事计前 5 名。",
          scoreRule: "A（含 A+）、B 类赛事奖励每项最高计 2.4 绩点；学院认定 C 类赛事加分总值不超过 1.2 绩点。团队获奖按贡献度和附表3分配比例计算。",
          cap: "同一项目在同一年度内参加不同赛事，就高计一次；具体赛事清单和分值以附表6、7、8为准。",
          organization: "上海海洋大学经济管理学院",
        },
      ],
      source,
    },
    {
      scope,
      year: 2026,
      collegeName: "经济管理学院",
      applicabilityLabel: "经济管理学院通用",
      category: "体育与美育",
      items: [
        {
          name: "体育类赛事奖项",
          condition: "参加市级及以上体育类赛事获奖。",
          scoreRule: "每项最高计 2.4 绩点；赛事类别及绩点明细见附表4。",
          cap: "同一学年的同一类奖项就高计算一次。",
          organization: "上海海洋大学经济管理学院",
        },
        {
          name: "美育类赛事奖项",
          condition: "参加市级及以上美育类赛事获奖。",
          scoreRule: "每项最高计 2.4 绩点；赛事类别及绩点明细见附表5。",
          cap: "同一学年的同一类奖项就高计算一次。",
          organization: "上海海洋大学经济管理学院",
        },
      ],
      source,
    },
    {
      scope,
      year: 2026,
      collegeName: "经济管理学院",
      applicabilityLabel: "经济管理学院通用",
      category: "志愿服务与国际组织实习",
      items: [
        {
          name: "志愿服务荣誉称号",
          condition: "由学校选派参加志愿服务，获得“优秀志愿者”等荣誉称号。",
          scoreRule: "国家级每项计 0.5 绩点；省市级每项计 0.2 绩点。",
          cap: "全学程就高计算一次。",
          organization: "上海海洋大学经济管理学院",
        },
        {
          name: "国际组织实习",
          condition: "由学校选派至国际组织实习 3 个月及以上，并按期完成实习任务。",
          scoreRule: "每次计 0.5 绩点。",
          cap: "按学院实施办法附件1执行。",
          organization: "上海海洋大学经济管理学院",
        },
      ],
      source,
    },
  ];
}

export function extractPolicyBundle(parsedPolicies, { schoolId, collegeId }) {
  const policySource =
    parsedPolicies.find((item) => item.source?.year === 2026 || item.year === 2026) ||
    parsedPolicies[0];

  if (!policySource) {
    return {
      policy: null,
      rankingRule: null,
      bonusRules: [],
      evidenceText: "",
    };
  }

  const text = normalizePolicyText(policySource.text);
  const hasCoreEvidence =
    hasAll(text, ["推荐成绩", "0.75", "加分绩点", "大学英语四级", "425"]) &&
    hasAll(text, ["入伍服兵役", "学科竞赛", "志愿服务", "国际组织实习"]);

  if (!hasCoreEvidence) {
    console.warn("政策 PDF 核心字段未完全命中，将仍按已登记官方来源生成结构化摘要，请人工复核。");
  }

  const source = makeSource(policySource);
  const scope = makeScope({ schoolId, collegeId });

  return {
    policy: buildPolicy({ source, scope }),
    rankingRule: buildRankingRule({ source, scope }),
    bonusRules: buildBonusRules({ source, scope }),
    evidenceText: shortEvidence(text, 180),
  };
}
