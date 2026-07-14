export async function fetchMySchoolRecommendationData(schoolId, { signal } = {}) {
  if (!schoolId) return null;
  const response = await fetch(`/data/my-school/${schoolId}.json`, {
    signal,
    cache: "no-cache",
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function getSchoolLevelRecommendationData(data) {
  return data?.recommendationData?.schoolLevel || null;
}

export function getCollegeRecommendationData(data, { collegeId, collegeName } = {}) {
  const colleges = data?.recommendationData?.colleges;
  if (!Array.isArray(colleges)) return null;
  return (
    colleges.find((college) => collegeId && college.collegeId === collegeId) ||
    colleges.find((college) => collegeName && college.collegeName === collegeName) ||
    null
  );
}

export function getMajorRecommendationData(data, { collegeId, collegeName, majorName } = {}) {
  const college = getCollegeRecommendationData(data, { collegeId, collegeName });
  if (!college || !Array.isArray(college.majors) || !majorName) return null;
  return college.majors.find((major) => major.majorName === majorName) || null;
}

function scopeMatches(scope, binding = {}) {
  if (!scope) return false;
  if (scope.schoolId && binding.schoolId && scope.schoolId !== binding.schoolId) return false;

  const collegeMatches =
    scope.appliesToAllColleges ||
    !scope.collegeId ||
    scope.collegeId === binding.collegeId ||
    (!!scope.collegeName && scope.collegeName === binding.collegeName);
  if (!collegeMatches) return false;

  const majorMatches =
    scope.appliesToAllMajors ||
    !scope.majorId ||
    scope.majorId === binding.majorId ||
    (!!scope.majorName && scope.majorName === (binding.majorName || binding.major));
  return majorMatches;
}

function yearMatches(item, binding = {}) {
  if (!binding.graduationYear || !item?.year) return true;
  return Number(item.year) === Number(binding.graduationYear);
}

function scopePriority(scope = {}) {
  if (scope.majorId) return 3;
  if (scope.collegeId) return 2;
  if (scope.appliesToAllColleges) return 1;
  return 0;
}

export function getMatchedRecommendationData(data, binding = {}) {
  const schoolLevel = getSchoolLevelRecommendationData(data);
  const colleges = Array.isArray(data?.recommendationData?.colleges) ? data.recommendationData.colleges : [];
  const matchedColleges = colleges.filter((college) => scopeMatches(college.scope, binding) && yearMatches(college, binding));
  const matchedCollege = matchedColleges.sort((a, b) => scopePriority(b.scope) - scopePriority(a.scope))[0] || null;
  const majors = matchedCollege?.majors || [];
  const matchedMajor =
    majors.find((major) => scopeMatches(major.scope, binding) && yearMatches(major, binding)) ||
    getMajorRecommendationData(data, {
      collegeId: binding.collegeId,
      collegeName: binding.collegeName,
      majorName: binding.majorName || binding.major,
    });

  const policies = (Array.isArray(data?.policies) ? data.policies : [])
    .filter((item) => scopeMatches(item.scope, binding) && yearMatches(item, binding))
    .sort((a, b) => scopePriority(b.scope) - scopePriority(a.scope));
  const rankingRules = (Array.isArray(data?.rankingRules) ? data.rankingRules : [])
    .filter((item) => scopeMatches(item.scope, binding) && yearMatches(item, binding))
    .sort((a, b) => scopePriority(b.scope) - scopePriority(a.scope));
  const bonusRules = (Array.isArray(data?.bonusRules) ? data.bonusRules : [])
    .filter((item) => scopeMatches(item.scope, binding) && yearMatches(item, binding))
    .sort((a, b) => scopePriority(b.scope) - scopePriority(a.scope));
  const notices = (Array.isArray(data?.notices) ? data.notices : [])
    .filter((item) => scopeMatches(item.scope, binding) && yearMatches(item, binding))
    .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
  const historicalTrend = (Array.isArray(data?.historicalTrend) ? data.historicalTrend : []).filter((item) =>
    scopeMatches(item.scope, binding),
  );
  const accountingHistory = (Array.isArray(data?.accountingRecommendationHistory) ? data.accountingRecommendationHistory : [])
    .filter((item) => scopeMatches(item.scope, binding))
    .sort((a, b) => b.graduationYear - a.graduationYear);

  return {
    schoolLevel: schoolLevel && scopeMatches(schoolLevel.scope, binding) && yearMatches(schoolLevel, binding) ? schoolLevel : null,
    college: matchedCollege,
    major: matchedMajor || null,
    policy: policies[0] || null,
    rankingRule: rankingRules[0] || null,
    bonusRules,
    notices,
    historicalTrend,
    accountingHistory,
  };
}

export function getLatestThreeAccountingYears(history = []) {
  const years = [...new Set(history.map((item) => item.graduationYear).filter(Boolean))].sort((a, b) => b - a);
  const latestYears = years.slice(0, 3);
  if (latestYears.length >= 3) return latestYears.map((year) => history.find((item) => item.graduationYear === year) || { graduationYear: year });
  const latest = latestYears[0] || new Date().getFullYear();
  while (latestYears.length < 3) latestYears.push(latest - latestYears.length);
  return latestYears.map((year) => history.find((item) => item.graduationYear === year) || { graduationYear: year, dataStatus: "missing" });
}

export function getSourceLevelLabel(sourceLevel, dataStatus) {
  if (dataStatus === "missing") return "数据不完整";
  if (sourceLevel === "official") return "官方数据";
  if (sourceLevel === "credible-reference") return "公开参考数据";
  if (sourceLevel === "third-party-estimate") return "估算值，仅供参考";
  return "数据不完整";
}

export function getLatestRecommendationPolicy(data, { collegeName } = {}) {
  const policies = Array.isArray(data?.policies) ? data.policies : [];
  return (
    policies.find((policy) => collegeName && policy.collegeName === collegeName) ||
    policies.find((policy) => policy.scopeType === "school") ||
    policies[0] ||
    null
  );
}

export function getLatestRankingRule(data, { collegeName } = {}) {
  const rules = Array.isArray(data?.rankingRules) ? data.rankingRules : [];
  return rules.find((rule) => collegeName && rule.collegeName === collegeName) || rules[0] || null;
}

export function getBonusRules(data, { collegeName } = {}) {
  const rules = Array.isArray(data?.bonusRules) ? data.bonusRules : [];
  const scoped = rules.filter((rule) => !collegeName || rule.collegeName === collegeName);
  return scoped.length ? scoped : rules;
}

export function getRecommendationNotices(data, { collegeName, majorName } = {}) {
  const notices = Array.isArray(data?.notices) ? data.notices : [];
  return notices.filter((notice) => {
    if (!collegeName && !majorName) return true;
    return !notice.collegeName || notice.collegeName === collegeName;
  });
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return `${(Number(value) * 100).toFixed(2)}%`;
}
