import React, { useEffect, useRef } from "react";
import { Send } from "lucide-react";

export default function ReplyComposer({
  value,
  placeholder,
  submitting = false,
  errorMessage = "",
  submitLabel = "发布回复",
  onChange,
  onCancel,
  onSubmit,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
      <textarea
        ref={textareaRef}
        className="field-control min-h-[84px] resize-y bg-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={submitting}
      />
      {errorMessage && <p className="mt-2 text-sm font-semibold text-red-600">{errorMessage}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-secondary px-3 py-2" onClick={onCancel} disabled={submitting}>
            取消
          </button>
        )}
        <button
          type="button"
          className="btn-primary px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-300"
          onClick={onSubmit}
          disabled={submitting}
        >
          <Send size={16} aria-hidden="true" />
          {submitting ? "发布中..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
