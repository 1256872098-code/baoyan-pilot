import React from "react";

export default function AuthorAvatar({ name, avatarUrl, className = "h-6 w-6" }) {
  if (avatarUrl) {
    return <img className={`${className} rounded-full object-cover`} src={avatarUrl} alt={`${name} 的头像`} />;
  }

  return (
    <span className={`${className} inline-flex items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-brand-700`}>
      {String(name || "匿").slice(0, 1)}
    </span>
  );
}
