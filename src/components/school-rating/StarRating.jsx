import React, { useState } from "react";
import { Star } from "lucide-react";

export default function StarRating({ value = 0, readOnly = false, size = 20, onChange, label = "学校评分" }) {
  const [hoverValue, setHoverValue] = useState(0);
  const activeValue = hoverValue || value;

  if (readOnly) {
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={`${label}：${value || 0} 星`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            className={star <= Math.round(value) ? "text-amber-400" : "text-slate-300"}
            fill={star <= Math.round(value) ? "currentColor" : "none"}
            aria-hidden="true"
          />
        ))}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="rounded-sm p-0.5 text-amber-400 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} 星`}
          onMouseEnter={() => setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          onFocus={() => setHoverValue(star)}
          onBlur={() => setHoverValue(0)}
          onClick={() => onChange?.(star)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              onChange?.(Math.min(5, (value || 0) + 1));
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              onChange?.(Math.max(1, (value || 1) - 1));
            }
          }}
        >
          <Star
            size={size}
            fill={star <= activeValue ? "currentColor" : "none"}
            className={star <= activeValue ? "text-amber-400" : "text-slate-300"}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}
