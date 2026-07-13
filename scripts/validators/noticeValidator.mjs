const allowedTypes = new Set([
  "policy",
  "summer-camp",
  "pre-recommendation",
  "catalog",
  "requirement",
  "material",
  "assessment",
  "timeline",
  "other",
]);

export function validateNotice(notice) {
  const errors = [];

  if (!notice?.id) errors.push("缺少 id");
  if (!notice?.title) errors.push("缺少 title");
  if (!allowedTypes.has(notice?.type)) errors.push(`资料类型不合法：${notice?.type}`);
  if (notice?.year !== null && notice?.year !== undefined && !Number.isInteger(Number(notice.year))) {
    errors.push("year 必须为数字或 null");
  }
  if (!notice?.source?.url) errors.push("缺少官方原文链接 source.url");
  if (!notice?.source?.title) errors.push("缺少来源单位 source.title");
  if (!notice?.lastCheckedAt) errors.push("缺少 lastCheckedAt");

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCollegeDetail(detail) {
  const errors = [];

  if (!detail?.schoolId) errors.push("缺少 schoolId");
  if (!detail?.collegeId) errors.push("缺少 collegeId");
  if (!detail?.collegeName) errors.push("缺少 collegeName");
  if (!Array.isArray(detail?.notices)) errors.push("notices 必须是数组");

  (detail?.notices || []).forEach((notice) => {
    const result = validateNotice(notice);
    if (!result.valid) {
      errors.push(`${notice?.title || notice?.id || "未命名资料"}：${result.errors.join("；")}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
