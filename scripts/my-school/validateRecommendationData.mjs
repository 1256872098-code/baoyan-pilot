import {
  getOutputPath,
  getSchoolByName,
  isCliModule,
  isOfficialUrl,
  parseArgs,
  readJson,
  reviewPath,
  shouName,
  writeJsonAtomic,
} from "./common.mjs";

function addIssue(issues, code, message, context = {}) {
  issues.push({
    code,
    message,
    context,
    createdAt: new Date().toISOString(),
  });
}

function checkNumber(issues, path, value) {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 0) {
    addIssue(issues, "invalid-number", `${path} 必须是非负整数。`, { path, value });
  }
}

function checkRate(issues, path, value) {
  if (value == null) return;
  if (typeof value !== "number" || value < 0 || value > 1) {
    addIssue(issues, "invalid-rate", `${path} 必须在0到1之间。`, { path, value });
  }
}

function checkSources(issues, path, sources = []) {
  for (const source of sources || []) {
    const url = source.sourceUrl || source.url;
    if (!url || !isOfficialUrl(url)) {
      addIssue(issues, "unofficial-source", `${path} 存在非官方或缺失来源。`, { path, url });
    }
  }
}

export function validateRecommendationData(data) {
  const issues = [];
  const schoolLevel = data?.recommendationData?.schoolLevel || {};
  checkNumber(issues, "recommendationData.schoolLevel.recommendationQuota", schoolLevel.recommendationQuota);
  checkNumber(issues, "recommendationData.schoolLevel.recommendedCount", schoolLevel.recommendedCount);
  checkNumber(issues, "recommendationData.schoolLevel.cohortSize", schoolLevel.cohortSize);
  checkRate(issues, "recommendationData.schoolLevel.recommendationRate", schoolLevel.recommendationRate);
  checkSources(issues, "recommendationData.schoolLevel.sources", schoolLevel.sources);

  if (schoolLevel.recommendationRate == null && schoolLevel.recommendedCount != null) {
    addIssue(issues, "rate-unavailable", "学校层面缺少同口径本科毕业生人数，未计算推免率。");
  }
  if (schoolLevel.recommendationQuota == null) {
    addIssue(issues, "quota-unavailable", "学校层面未识别到官方推荐名额字段。");
  }

  for (const college of data?.recommendationData?.colleges || []) {
    checkNumber(issues, `college:${college.collegeName}.recommendationQuota`, college.recommendationQuota);
    checkNumber(issues, `college:${college.collegeName}.recommendedCount`, college.recommendedCount);
    checkNumber(issues, `college:${college.collegeName}.cohortSize`, college.cohortSize);
    checkRate(issues, `college:${college.collegeName}.recommendationRate`, college.recommendationRate);
    checkSources(issues, `college:${college.collegeName}.sources`, college.sources);
    if (college.recommendationRate == null && college.recommendedCount != null) {
      addIssue(issues, "rate-unavailable", `${college.collegeName}缺少同口径本科毕业生人数，未计算推免率。`);
    }
    if (college.recommendationQuota == null) {
      addIssue(issues, "quota-unavailable", `${college.collegeName}未识别到官方推荐名额字段。`);
    }
    for (const major of college.majors || []) {
      checkNumber(issues, `major:${major.majorName}.recommendationQuota`, major.recommendationQuota);
      checkNumber(issues, `major:${major.majorName}.recommendedCount`, major.recommendedCount);
      checkNumber(issues, `major:${major.majorName}.cohortSize`, major.cohortSize);
      checkRate(issues, `major:${major.majorName}.recommendationRate`, major.recommendationRate);
      checkSources(issues, `major:${major.majorName}.sources`, major.sources);
      if (major.recommendationRate == null && major.recommendedCount != null) {
        addIssue(issues, "rate-unavailable", `${major.majorName}缺少同口径本科毕业生人数，未计算推免率。`);
      }
      if (major.recommendationQuota == null) {
        addIssue(issues, "quota-unavailable", `${major.majorName}未识别到官方推荐名额字段。`);
      }
    }
  }

  for (const notice of data.notices || []) {
    if (!isOfficialUrl(notice.sourceUrl)) {
      addIssue(issues, "unofficial-notice", "通知来源不是官方域名。", { title: notice.title, sourceUrl: notice.sourceUrl });
    }
  }

  return {
    valid: issues.every((issue) => !["invalid-number", "invalid-rate", "unofficial-source", "unofficial-notice"].includes(issue.code)),
    issues,
  };
}

if (isCliModule(import.meta.url)) {
  const args = parseArgs();
  const school = await getSchoolByName(args["school-name"] || shouName);
  const data = await readJson(getOutputPath(school.id), null);
  if (!data) {
    console.error("未找到推免数据文件，请先执行 crawl:my-school:shou。");
    process.exit(1);
  }
  const result = validateRecommendationData(data);
  await writeJsonAtomic(reviewPath, {
    schoolId: school.id,
    schoolName: school.name,
    issues: result.issues,
    generatedAt: new Date().toISOString(),
  });
  console.log(`验证结果：${result.valid ? "通过" : "需要复核"}`);
  console.log(`复核项：${result.issues.length}`);
  if (!result.valid) process.exit(1);
}
