import React from "react";
import NoticeCard from "./NoticeCard.jsx";
import NoticeEmptyState from "./NoticeEmptyState.jsx";

export default function NoticeList({ notices }) {
  if (!notices.length) {
    return <NoticeEmptyState />;
  }

  return (
    <div className="space-y-4">
      {notices.map((notice) => (
        <NoticeCard key={notice.id || notice.source?.url || notice.title} notice={notice} />
      ))}
    </div>
  );
}
