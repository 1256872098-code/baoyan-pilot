const optionalAuthorFields = [
  "author_avatar",
  "author_school_id",
  "author_school_name",
  "author_school_level_tags",
];

export const forumAuthorProfileColumns = optionalAuthorFields.join(",");

export function normalizeAuthorLevelTags(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

export function getForumAuthorPayload(user) {
  const levelTags = normalizeAuthorLevelTags(user?.school_level_tags);

  return {
    author_id: user.id,
    author_name: user.nickname || (user.phone ? `用户${String(user.phone).slice(-4)}` : "保研用户"),
    author_avatar: user.avatar || user.avatarUrl || "",
    author_school_id: user.school_id || null,
    author_school_name: user.school_name || "",
    author_school_level_tags: levelTags,
    login_type: user.loginType || "phone_mock",
  };
}

export function stripOptionalAuthorFields(payload) {
  return Object.fromEntries(Object.entries(payload || {}).filter(([key]) => !optionalAuthorFields.includes(key)));
}

export function isAuthorProfileColumnError(error) {
  const text = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(" ").toLowerCase();
  return optionalAuthorFields.some((field) => text.includes(field.toLowerCase()));
}
