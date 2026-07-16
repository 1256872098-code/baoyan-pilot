export const REQUIRED_PROFILE_FIELDS = Object.freeze([
  { key: "grade", label: "年级" },
  { key: "major", label: "专业" },
  { key: "schoolBackground", label: "本科院校或层次" },
  { key: "gpa", label: "GPA/均分及口径" },
  { key: "ranking", label: "专业排名或范围" },
  { key: "english", label: "四级、六级情况" },
  { key: "research", label: "科研经历" },
  { key: "papers", label: "论文情况" },
  { key: "competition", label: "竞赛经历" },
  { key: "practice", label: "实习实践或学生工作" },
  { key: "targetDirection", label: "目标专业方向" },
  { key: "preferredRegion", label: "意向城市或地区" },
  { key: "riskPreference", label: "风险偏好" },
]);

const PROFILE_STATUS_MARKER_SOURCE =
  "<!--\\s*baoyanpilot-profile-status\\s*:\\s*([\\s\\S]*?)\\s*-->";
const UNCONFIRMED_VALUE_PATTERN =
  /^(?:null|undefined|n\/?a)$|未提供|尚未提供|未提及|未说明|未确认|尚未确认|待补充|待确认/i;
const SUBSTANTIVE_PROFILE_FIELDS = new Set([
  "grade",
  "major",
  "schoolBackground",
  "targetDirection",
  "preferredRegion",
  "riskPreference",
]);
const NON_SUBSTANTIVE_VALUE_PATTERN =
  /^(?:不清楚|不知道|不了解|未知|暂无|没有|未定|还没想好|暂不考虑)$/i;

export function normalizeProfileStatus(value) {
  const source = value?.profile && typeof value.profile === "object" ? value.profile : value;
  const profile = Object.fromEntries(
    REQUIRED_PROFILE_FIELDS.map(({ key }) => {
      const fieldValue = source?.[key];
      const normalizedValue =
        typeof fieldValue === "string" || typeof fieldValue === "number"
          ? String(fieldValue).trim().slice(0, 500)
          : "";

      const isUnconfirmed =
        UNCONFIRMED_VALUE_PATTERN.test(normalizedValue) ||
        (SUBSTANTIVE_PROFILE_FIELDS.has(key) &&
          NON_SUBSTANTIVE_VALUE_PATTERN.test(normalizedValue));

      return [key, isUnconfirmed ? "" : normalizedValue];
    }),
  );
  const fields = Object.fromEntries(
    REQUIRED_PROFILE_FIELDS.map(({ key }) => [key, Boolean(profile[key])]),
  );
  const missingFields = REQUIRED_PROFILE_FIELDS.filter(({ key }) => !fields[key]).map(
    ({ key }) => key,
  );

  return {
    profile,
    fields,
    missingFields,
    confirmedCount: REQUIRED_PROFILE_FIELDS.length - missingFields.length,
    totalCount: REQUIRED_PROFILE_FIELDS.length,
    isComplete: missingFields.length === 0,
  };
}

export function createEmptyProfileStatus() {
  return normalizeProfileStatus(null);
}

export function isProfileReadyForReport(value, isValidated) {
  return isValidated === true && normalizeProfileStatus(value).isComplete;
}

export function getMissingProfileLabels(value) {
  const status = normalizeProfileStatus(value);
  return REQUIRED_PROFILE_FIELDS.filter(({ key }) => !status.fields[key]).map(
    ({ label }) => label,
  );
}

export function extractProfileStatusMarker(content, fallbackStatus = null) {
  const value = String(content || "");
  const matches = Array.from(
    value.matchAll(new RegExp(PROFILE_STATUS_MARKER_SOURCE, "gi")),
  );
  const match = matches[matches.length - 1];
  const markerEndsReply = Boolean(
    match && !value.slice(match.index + match[0].length).trim(),
  );
  let parsedStatus = null;

  if (matches.length === 1 && markerEndsReply) {
    try {
      parsedStatus = JSON.parse(match[1]);
    } catch {
      parsedStatus = null;
    }
  }

  return {
    content: value
      .replace(new RegExp(PROFILE_STATUS_MARKER_SOURCE, "gi"), "")
      .trim(),
    profileStatus: normalizeProfileStatus(parsedStatus || fallbackStatus),
    hasValidMarker: Boolean(parsedStatus && typeof parsedStatus === "object"),
  };
}
