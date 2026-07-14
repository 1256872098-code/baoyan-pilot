import {
  getShouCollegeId,
  isOfficialUrl,
  makeMajorId,
  sha256,
  shortEvidence,
  shouCollegeName,
  shouMajorName,
  sourceEvidence,
} from "./common.mjs";

function allParsedSources(parsedSources) {
  const result = [];
  for (const source of parsedSources) {
    result.push(source);
    if (Array.isArray(source.parsedAttachments)) {
      result.push(...source.parsedAttachments);
    }
  }
  return result.filter((source) => source?.url && !source.parseError);
}

function countFromJwcPdf(source) {
  if (!/jwc\.shou\.edu\.cn/.test(source.url) || source.contentType !== "pdf") return null;
  const lines = String(source.rawText || source.text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let total = 0;
  let college = 0;
  let major = 0;
  for (const line of lines) {
    const serial = line.match(/^(\d{1,3})\s+/);
    if (serial) total = Math.max(total, Number(serial[1]));
    if (/^\d{1,3}\s+经济管理学院\s+/.test(line)) college += 1;
    if (/^\d{1,3}\s+经济管理学院\s+会计学\s+/.test(line)) major += 1;
  }

  return total || college || major
    ? {
        total,
        college,
        major,
        evidenceText: "上海海洋大学2026年推荐优秀应届本科毕业生免试攻读研究生名单公示表格计数。",
      }
    : null;
}

function countFromCollegeList(source) {
  if (!/jmxy\.shou\.edu\.cn/.test(source.url) || !/名单|公示/.test(`${source.title} ${source.name}`)) return null;
  const text = source.text || "";
  const majorMatches = new Map();
  const majorPattern = /((?:农林经济管理|金融学|国际经济与贸易|会计学|物流管理|工商管理|行政管理|文化产业管理))[:：\s]+([\u4e00-\u9fa5、，,\s]{2,120})/g;
  for (const match of text.matchAll(majorPattern)) {
    const names = match[2]
      .split(/[、，,\s]+/)
      .map((name) => name.trim())
      .filter((name) => /^[\u4e00-\u9fa5]{2,4}$/.test(name));
    if (names.length) majorMatches.set(match[1], names.length);
  }
  const total = [...majorMatches.values()].reduce((sum, value) => sum + value, 0);
  return total
    ? {
        total,
        major: majorMatches.get(shouMajorName) || 0,
        evidenceText: "经济管理学院2026年推免拟推荐名单按专业公示计数。",
      }
    : null;
}

function sourceSummary(source) {
  return {
    title: source.title || source.name || "",
    url: source.url,
    sourceType: source.sourceType || "",
    sourceOrganization: source.sourceOrganization || "",
    publishedAt: source.publishedAt || null,
    contentHash: sha256(`${source.title || ""}\n${source.text || ""}`),
  };
}

function noticeType(source) {
  if (source.sourceType === "admission-list") return "admission-result";
  if (source.sourceType === "admission-notice") return "admission-policy";
  if (source.sourceType === "recommendation-list") return "recommendation-result";
  if (source.sourceType === "quota-notice") return "quota";
  return "recommendation-policy";
}

function noticeSummary(source) {
  const type = source.sourceType;
  if (type === "admission-notice") {
    return "本校接收推免生信息，属于研究生招生接收政策，不等同于本科生推荐推免名额。";
  }
  if (type === "admission-list") {
    return "本校拟录取推免生公示信息，属于最终录取数据，不等同于本科推荐推免名额。";
  }
  if (type === "recommendation-list") {
    return "本校推荐免试攻读研究生名单公示，可用于官方名单计数；不含同口径毕业生人数时不计算推免率。";
  }
  return "本校或学院推免政策信息，具体申请条件和材料要求以官方原文为准。";
}

function sourceRef(source) {
  return {
    title: source.title || source.name || "",
    url: source.url,
    sourceType: source.sourceType || "",
    publishedAt: source.publishedAt || null,
    sourceOrganization: source.sourceOrganization || "",
    contentHash: sha256(`${source.title || ""}\n${source.text || ""}`),
    lastCheckedAt: new Date().toISOString(),
  };
}

function buildCollegePolicy(policySource, { school, collegeId }) {
  if (!policySource) return null;
  const source = sourceRef(policySource);
  return {
    scope: {
      schoolId: school.id,
      collegeId,
      collegeName: shouCollegeName,
      majorId: null,
      majorName: null,
      appliesToAllColleges: false,
      appliesToAllMajors: true,
    },
    year: 2026,
    scopeType: "college",
    collegeName: shouCollegeName,
    title: policySource.title || "经济管理学院推荐优秀应届本科毕业生免试攻读研究生工作实施办法",
    eligibility: {
      studentStatus: [
        {
          text: "纳入国家普通本科招生计划录取的应届毕业生，具有上海海洋大学学籍，且未曾参与过推免环节。",
          evidence: shortEvidence("纳入国家普通本科招生计划录取的应届毕业生，具有上海海洋大学学籍，不曾参与过推免环节。"),
        },
      ],
      courseRequirements: [
        {
          text: "完成培养方案规定的前三年课程进度，必修课和限制性选修课无不及格成绩。",
          evidence: shortEvidence("必修课和限制性选修课无不及格成绩。"),
        },
      ],
      disciplineRequirements: [
        {
          text: "无任何考试作弊、剽窃他人学术成果或违法违纪受处分记录。",
          evidence: shortEvidence("无任何考试作弊、剽窃他人学术成果或违法违纪受处分记录。"),
        },
      ],
      languageRequirements: [
        {
          text: "全国大学英语四级成绩达到425分及以上；日语、韩语、法语等按文件列明等级要求执行。",
          evidence: shortEvidence("全国大学英语四级成绩达到425分及以上。"),
        },
      ],
      healthRequirements: [
        {
          text: "身体健康状况符合规定的体检标准。",
          evidence: shortEvidence("身体健康状况符合规定的体检标准。"),
        },
      ],
      otherRequirements: [
        {
          text: "特殊学术专长推免另按学院实施办法规定的专业范围、成绩门槛和成果要求执行。",
          evidence: shortEvidence("具有特殊学术专长的学生推免按专业范围、绩点排名和竞赛科研成果要求执行。"),
        },
      ],
    },
    materials: [
      {
        text: "《上海海洋大学推荐免试攻读硕士学位研究生申请审核表》。",
        evidence: shortEvidence("填写《上海海洋大学推荐免试攻读硕士学位研究生申请审核表》。"),
      },
      {
        text: "按学院通知提交相应证明材料。",
        evidence: shortEvidence("并提交相应证明材料。"),
      },
    ],
    schedule: [
      {
        text: "具体工作时间节点根据上级要求，由经济管理学院在启动当年该工作时公布。",
        evidence: shortEvidence("具体工作时间节点根据上级要求，由经济管理学院在启动当年该工作时公布。"),
      },
    ],
    source,
  };
}

function buildRankingRule(policySource, { school, collegeId }) {
  if (!policySource) return [];
  return [
    {
      scope: {
        schoolId: school.id,
        collegeId,
        collegeName: shouCollegeName,
        majorId: null,
        majorName: null,
        appliesToAllColleges: false,
        appliesToAllMajors: true,
      },
      year: 2026,
      collegeName: shouCollegeName,
      academicWeight: 0.75,
      bonusWeight: 0.25,
      formula: "推荐成绩 = 入学至推免时的全学程平均学分绩点 × 0.75 + 加分绩点 × 0.25",
      rankingScope: "按学院实施办法和当年分配名额执行；同分时按全学程平均学分绩点排序。",
      rules: [
        "学业成绩按首次考试成绩计算，补考和重修成绩不用于推免学业成绩计算。",
        "学业成绩绩点和加分绩点均按满分4绩点计算。",
        "推荐成绩相同者，以全学程平均学分绩点高者优先推荐。",
      ],
      source: sourceRef(policySource),
    },
  ];
}

function buildBonusRules(policySource, { school, collegeId }) {
  if (!policySource) return [];
  const source = sourceRef(policySource);
  return [
    {
      scope: {
        schoolId: school.id,
        collegeId,
        collegeName: shouCollegeName,
        majorId: null,
        majorName: null,
        appliesToAllColleges: false,
        appliesToAllMajors: true,
      },
      year: 2026,
      collegeName: shouCollegeName,
      category: "竞赛",
      items: [
        {
          name: "学校认定的A、B类赛事及学院认定的C类赛事",
          condition: "限代表上海海洋大学获得的本科阶段荣誉和成果，且截至推免当年8月31日。",
          scoreRule: "A、B类赛事每项最高计2.4绩点；学院认定C类赛事加分总值不超过1.2绩点。具体获奖等级、名次和计分以学院原文表格为准。",
          cap: "按学院实施办法表格执行",
          evidence: shortEvidence("A、B赛事奖励，每项最高计为2.4绩点；C类赛事奖励加分总值不超过1.2。"),
        },
      ],
      source,
    },
    {
      scope: {
        schoolId: school.id,
        collegeId,
        collegeName: shouCollegeName,
        majorId: null,
        majorName: null,
        appliesToAllColleges: false,
        appliesToAllMajors: true,
      },
      year: 2026,
      collegeName: shouCollegeName,
      category: "科研",
      items: [
        {
          name: "论文、发明专利等科研成果",
          condition: "仅按学院实施办法中列明的成果类别、作者顺位和认定范围执行。",
          scoreRule: "文件列明了不同科研成果的加分口径；未在页面中抽取为确定数值的项目不在网页端扩写。",
          cap: null,
          evidence: shortEvidence("科研成果包括论文、发明专利等，具体加分按学院实施办法执行。"),
        },
      ],
      source,
    },
    {
      scope: {
        schoolId: school.id,
        collegeId,
        collegeName: shouCollegeName,
        majorId: null,
        majorName: null,
        appliesToAllColleges: false,
        appliesToAllMajors: true,
      },
      year: 2026,
      collegeName: shouCollegeName,
      category: "其他",
      items: [
        {
          name: "入伍服兵役、志愿服务、国际组织实习、体育美育赛事等",
          condition: "按学院实施办法列明的认定范围和材料要求执行。",
          scoreRule: "页面不扩写未核验的具体数值，需查看官方原文表格。",
          cap: null,
          evidence: shortEvidence("加分项目包括入伍服兵役、志愿服务、国际组织实习、体育类赛事、美育类赛事。"),
        },
      ],
      source,
    },
  ];
}

function buildTimeline(sources) {
  const result = [];
  const collegeList = sources.find((source) => /0913/.test(source.url));
  if (collegeList) {
    result.push({
      year: 2026,
      event: "经济管理学院拟推荐名单公示",
      startDate: "2025-09-13",
      endDate: "2025-09-15",
      source: sourceRef(collegeList),
    });
  }
  const schoolList = sources.find((source) => /jwc\.shou\.edu\.cn/.test(source.url) && source.contentType === "pdf");
  if (schoolList) {
    result.push({
      year: 2026,
      event: "学校推免名单公示",
      startDate: "2025-09-14",
      endDate: "2025-09-20",
      source: sourceRef(schoolList),
    });
  }
  const admission = sources.find((source) => source.sourceType === "admission-notice" && /yjs\.shou\.edu\.cn/.test(source.url));
  if (admission) {
    result.push({
      year: 2026,
      event: "接收推免生网上申请",
      startDate: "2025-09-22",
      endDate: "2025-10-20",
      source: sourceRef(admission),
    });
  }
  return result;
}

export async function normalizeRecommendationData({ school, parsedSources }) {
  const sources = allParsedSources(parsedSources).filter((source) => isOfficialUrl(source.url));
  const collegeId = await getShouCollegeId();
  const majorId = makeMajorId(collegeId, shouMajorName);
  const schoolListSource = sources.find((source) => /jwc\.shou\.edu\.cn/.test(source.url) && source.contentType === "pdf");
  const collegeListSource = sources.find((source) => /0913/.test(source.url));
  const policySource =
    sources.find((source) => source.contentType === "pdf" && /jmxy\.shou\.edu\.cn/.test(source.url) && /实施办法|推荐/.test(`${source.title} ${source.name}`)) ||
    sources.find((source) => /0817/.test(source.url));

  const schoolCount = schoolListSource ? countFromJwcPdf(schoolListSource) : null;
  const collegeCount = collegeListSource ? countFromCollegeList(collegeListSource) : null;
  const collegeRecommendedCount = schoolCount?.college || collegeCount?.total || null;
  const majorRecommendedCount = schoolCount?.major || collegeCount?.major || null;
  const schoolRecommendedCount = schoolCount?.total || null;
  const countSource = schoolListSource || collegeListSource;

  const countEvidence = countSource
    ? sourceEvidence({
        value: schoolRecommendedCount,
        source: countSource,
        evidenceText: schoolCount?.evidenceText || collegeCount?.evidenceText || "官方名单公示计数。",
      })
    : null;

  const collegeEvidence = countSource
    ? sourceEvidence({
        value: collegeRecommendedCount,
        source: countSource,
        evidenceText: "官方名单中经济管理学院记录计数。",
      })
    : null;

  const majorEvidence = countSource
    ? sourceEvidence({
        value: majorRecommendedCount,
        source: countSource,
        evidenceText: "官方名单中经济管理学院会计学记录计数。",
      })
    : null;

  const noticeScope = (source) => {
    const isCollege = source.collegeName || /jmxy\.shou\.edu\.cn/.test(source.url);
    if (source.sourceType === "admission-notice" || source.sourceType === "admission-list") {
      return {
        schoolId: school.id,
        collegeId: isCollege ? collegeId : null,
        collegeName: isCollege ? shouCollegeName : null,
        majorId: null,
        majorName: null,
        appliesToAllColleges: !isCollege,
        appliesToAllMajors: true,
      };
    }
    return {
      schoolId: school.id,
      collegeId: isCollege ? collegeId : null,
      collegeName: isCollege ? shouCollegeName : null,
      majorId: null,
      majorName: null,
      appliesToAllColleges: !isCollege,
      appliesToAllMajors: true,
    };
  };

  const notices = sources
    .filter((source) => source.contentType !== "docx")
    .map((source) => ({
      scope: noticeScope(source),
      id: sha256(source.url).slice(0, 12),
      year: source.year || 2026,
      title: source.title || source.name || "",
      noticeType: noticeType(source),
      collegeName: source.collegeName ?? (/jmxy\.shou\.edu\.cn/.test(source.url) ? shouCollegeName : null),
      publishedAt: source.publishedAt || null,
      summary: noticeSummary(source),
      sourceUrl: source.url,
      sourceOrganization: source.sourceOrganization || "",
      sourceType: source.sourceType || "",
      label:
        source.sourceType === "admission-notice" || source.sourceType === "admission-list"
          ? "本校接收推免生信息"
          : "本校推荐推免信息",
    }))
    .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));

  const generatedAt = new Date().toISOString();
  const data = {
    schoolId: school.id,
    schoolName: school.name,
    latestDataYear: 2026,
    lastUpdatedAt: generatedAt,
    dataStatus: schoolRecommendedCount || collegeRecommendedCount || policySource ? "partial" : "pending-review",
    schoolOverview: {},
    recommendationData: {
      schoolLevel: {
        scope: {
          schoolId: school.id,
          collegeId: null,
          collegeName: null,
          majorId: null,
          majorName: null,
          appliesToAllColleges: true,
          appliesToAllMajors: true,
        },
        year: 2026,
        recommendationQuota: null,
        recommendedCount: schoolRecommendedCount,
        countMethod: schoolRecommendedCount ? "official-list-count" : null,
        containsWaitlist: false,
        cohortSize: null,
        recommendationRate: null,
        rateStatus: "unavailable",
        rateUnavailableReason: "尚未获得同口径本科毕业生人数，暂无法计算推免率。",
        sources: countEvidence ? [countEvidence] : [],
      },
      colleges: [
        {
          scope: {
            schoolId: school.id,
            collegeId,
            collegeName: shouCollegeName,
            majorId: null,
            majorName: null,
            appliesToAllColleges: false,
            appliesToAllMajors: true,
          },
          collegeId,
          collegeName: shouCollegeName,
          year: 2026,
          recommendationQuota: null,
          recommendedCount: collegeRecommendedCount,
          countMethod: collegeRecommendedCount ? "official-list-count" : null,
          containsWaitlist: false,
          cohortSize: null,
          recommendationRate: null,
          rateStatus: "unavailable",
          rateUnavailableReason: "尚未获得同口径本科毕业生人数，暂无法计算推免率。",
          majors: [
            {
              scope: {
                schoolId: school.id,
                collegeId,
                collegeName: shouCollegeName,
                majorId,
                majorName: shouMajorName,
                appliesToAllColleges: false,
                appliesToAllMajors: false,
              },
              majorId,
              majorName: shouMajorName,
              recommendationQuota: null,
              recommendedCount: majorRecommendedCount,
              countMethod: majorRecommendedCount ? "official-list-count" : null,
              containsWaitlist: false,
              cohortSize: null,
              recommendationRate: null,
              rateStatus: "unavailable",
              rateUnavailableReason: "尚未获得同口径本科毕业生人数，暂无法计算推免率。",
              sources: majorEvidence ? [majorEvidence] : [],
            },
          ],
          sources: collegeEvidence ? [collegeEvidence] : [],
        },
      ],
    },
    policies: policySource ? [buildCollegePolicy(policySource, { school, collegeId })] : [],
    rankingRules: buildRankingRule(policySource, { school, collegeId }),
    bonusRules: buildBonusRules(policySource, { school, collegeId }),
    timeline: buildTimeline(sources),
    notices,
    historicalTrend: [
      {
        scope: {
          schoolId: school.id,
          collegeId: null,
          collegeName: null,
          majorId: null,
          majorName: null,
          appliesToAllColleges: true,
          appliesToAllMajors: true,
        },
        year: 2026,
        recommendationQuota: null,
        recommendedCount: schoolRecommendedCount,
        cohortSize: null,
        recommendationRate: null,
        dataScope: "school",
        collegeName: null,
        majorName: null,
        sources: countEvidence ? [countEvidence] : [],
      },
      {
        scope: {
          schoolId: school.id,
          collegeId,
          collegeName: shouCollegeName,
          majorId: null,
          majorName: null,
          appliesToAllColleges: false,
          appliesToAllMajors: true,
        },
        year: 2026,
        recommendationQuota: null,
        recommendedCount: collegeRecommendedCount,
        cohortSize: null,
        recommendationRate: null,
        dataScope: "college",
        collegeName: shouCollegeName,
        majorName: null,
        sources: collegeEvidence ? [collegeEvidence] : [],
      },
      {
        scope: {
          schoolId: school.id,
          collegeId,
          collegeName: shouCollegeName,
          majorId,
          majorName: shouMajorName,
          appliesToAllColleges: false,
          appliesToAllMajors: false,
        },
        year: 2026,
        recommendationQuota: null,
        recommendedCount: majorRecommendedCount,
        cohortSize: null,
        recommendationRate: null,
        dataScope: "major",
        collegeName: shouCollegeName,
        majorName: shouMajorName,
        sources: majorEvidence ? [majorEvidence] : [],
      },
    ],
    sourceSummaries: sources.map(sourceSummary),
    parseMeta: {
      processedSources: parsedSources.length,
      verifiedSources: sources.length,
      generatedAt,
    },
  };

  return data;
}
