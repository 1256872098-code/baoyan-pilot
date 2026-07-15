import React from "react";
import { GraduationCap } from "lucide-react";
import { normalizeAuthorLevelTags } from "../../utils/forumAuthorProfile.js";

const highlightedLevelTags = new Set(["985", "211", "双一流"]);

export default function AuthorSchoolBadge({ schoolName, levelTags }) {
  if (!schoolName) return null;

  const visibleTags = normalizeAuthorLevelTags(levelTags).filter((tag) => highlightedLevelTags.has(tag));

  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
      <GraduationCap size={12} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{schoolName}</span>
      {visibleTags.length > 0 && (
        <span className="hidden items-center gap-1 sm:inline-flex">
          {visibleTags.map((tag) => (
            <span key={tag} className="rounded-full bg-white/80 px-1.5 py-0.5">
              {tag}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
