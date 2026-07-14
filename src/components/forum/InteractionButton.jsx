import React from "react";

export default function InteractionButton({
  icon: Icon,
  label,
  count,
  active = false,
  activeTone = "brand",
  disabled = false,
  onClick,
  title,
}) {
  const handleClick = (event) => {
    event.stopPropagation();
    onClick?.(event);
  };

  const activeClass =
    activeTone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-blue-200 bg-blue-50 text-brand-700";

  return (
    <button
      type="button"
      className={[
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition",
        active ? activeClass : "border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-700",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
      onClick={handleClick}
      disabled={disabled}
      title={title || label}
    >
      <Icon size={15} aria-hidden="true" />
      <span>{label}</span>
      {typeof count === "number" && <span>{count}</span>}
    </button>
  );
}
