import { sha256, shortEvidence } from "../common.mjs";

export function extractPolicyBundle(parsedPolicies, { schoolId, collegeId, majorId }) {
  const policySource = parsedPolicies.find((item) => item.source?.year === 2026 || item.year === 2026) || parsedPolicies[0];
  if (!policySource) {
    return {
      policy: null,
      rankingRule: null,
      bonusRules: [],
    };
  }

  const source = {
    title: policySource.title || policySource.name || "经济管理学院推免实施办法",
    url: policySource.url,
    sourceType: "policy",
    publishedAt: policySource.publishedAt || null,
    sourceOrganization: policySource.sourceOrganization || "上海海洋大学经济管理学院",
    sourceLevel: "official",
    contentHash: sha256(policySource.text || ""),
    lastCheckedAt: new Date().toISOString(),
  };
  const scope = {
    schoolId,
    collegeId,
    collegeName: "经济管理学院",
    majorId: null,
    majorName: null,
    appliesToAllColleges: false,
    appliesToAllMajors: true,
    label: "经济管理学院通用",
  };

  const policy = {
    scope,
    year: 2026,
    scopeType: "college",
    collegeName: "经济管理学院",
    applicabilityLabel: "经济管理学院通用",
    title: source.title,
    eligibility: {
      studentStatus: [
        { text: "纳入国家普通本科招生计划录取的应届毕业生，具有上海海洋大学学籍，且未曾参与过推免环节。" },
      ],
      courseRequirements: [
        { text: "完成培养方案规定的前三年课程进度，必修课和限制性选修课无不及格成绩。" },
      ],
      disciplineRequirements: [
        { text: "无考试作弊、剽窃他人学术成果或违法违纪受处分记录。" },
      ],
      languageRequirements: [
        { text: "全国大学英语四级成绩达到425分及以上；日语、韩语、法语等按文件列明等级要求执行。" },
      ],
      healthRequirements: [{ text: "身体健康状况符合规定的体检标准。" }],
      otherRequirements: [{ text: "特殊学术专长推免按学院实施办法列明的专业范围、成绩门槛和成果要求执行。" }],
    },
    materials: [
      { text: "《上海海洋大学推荐免试攻读硕士学位研究生申请审核表》。" },
      { text: "按学院通知提交相应证明材料。" },
    ],
    schedule: [{ text: "具体工作时间节点根据上级要求，由经济管理学院在启动当年该工作时公布。" }],
    procedure: [
      { text: "学生自主申报，学院审核排序，学院推免生推荐工作小组审定后公示。" },
      { text: "学院按学校分配名额确定推荐名单和候补名单，并报学校审核。" },
    ],
    source,
  };

  const rankingRule = {
    scope,
    year: 2026,
    collegeName: "经济管理学院",
    applicabilityLabel: "经济管理学院通用",
    academicWeight: 0.75,
    bonusWeight: 0.25,
    formula: "推荐成绩 = 入学至推免时的全学程平均学分绩点 × 0.75 + 加分绩点 × 0.25",
    rankingScope: "按学院实施办法和当年分配名额执行；同分时按全学程平均学分绩点排序。",
    rules: [
      "学业成绩按首次考试成绩计算，补考和重修成绩不用于推免学业成绩计算。",
      "学业成绩绩点和加分绩点均按满分4绩点计算。",
      "推荐成绩相同者，以全学程平均学分绩点高者优先推荐。",
      "官方文件公开了75%/25%的推荐成绩公式；未公开的细分项不在页面中扩写。",
    ],
    source,
  };

  const bonusRules = [
    {
      scope,
      year: 2026,
      collegeName: "经济管理学院",
      applicabilityLabel: "经济管理学院通用",
      category: "学科竞赛",
      items: [
        {
          name: "学校认定的A、B类赛事及学院认定的C类赛事",
          condition: "限代表上海海洋大学获得的本科阶段荣誉和成果，且截至推免当年8月31日。",
          scoreRule: "A、B类赛事每项最高计2.4绩点；学院认定C类赛事加分总值不超过1.2绩点。具体等级和名次以官方表格为准。",
          cap: "按学院实施办法表格执行",
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
      category: "科研与论文",
      items: [
        {
          name: "论文、发明专利等科研成果",
          condition: "按学院实施办法中列明的成果类别、作者顺位和认定范围执行。",
          scoreRule: "官方文件列明了不同科研成果的加分口径；页面不扩写未核验的具体分值。",
          cap: "官方文件未公开可机器可靠抽取的统一上限",
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
      category: "其他项目",
      items: [
        {
          name: "入伍服兵役、志愿服务、国际组织实习、体育美育赛事等",
          condition: "按学院实施办法列明的认定范围和材料要求执行。",
          scoreRule: "官方文件未公开可统一展示的具体分值时，页面只展示规则说明。",
          cap: "以官方原文为准",
          organization: "上海海洋大学经济管理学院",
        },
      ],
      source,
    },
  ];

  return {
    policy,
    rankingRule,
    bonusRules,
    evidenceText: shortEvidence(policySource.text || "", 180),
  };
}
