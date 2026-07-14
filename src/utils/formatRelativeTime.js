export function formatRelativeTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) {
    return "刚刚";
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "刚刚";
  }

  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}分钟前`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}小时前`;
  }

  if (diffMs < 2 * day) {
    return "昨天";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${month}/${dayOfMonth}`;
}
