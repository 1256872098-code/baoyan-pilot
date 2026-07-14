import React, { useEffect, useState } from "react";
import StarRating from "./StarRating.jsx";

export default function SchoolRatingForm({
  currentReview,
  submitting = false,
  deleting = false,
  onSubmit,
  onDelete,
  onRequireLogin,
  canWrite,
}) {
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setRating(currentReview?.rating || 0);
    setContent(currentReview?.content || "");
    setErrorMessage("");
  }, [currentReview]);

  const handleSubmit = () => {
    if (!canWrite) {
      onRequireLogin?.();
      return;
    }

    if (!rating) {
      setErrorMessage("请选择 1 到 5 星评分。");
      return;
    }

    const normalizedContent = content.trim();
    if (normalizedContent.length > 500) {
      setErrorMessage("文字评价不能超过 500 字。");
      return;
    }

    setErrorMessage("");
    onSubmit?.({ rating, content: normalizedContent });
  };

  const handleDelete = () => {
    if (!canWrite) {
      onRequireLogin?.();
      return;
    }
    onDelete?.();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-950">{currentReview ? "修改我的评价" : "发布学校评价"}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            请结合真实体验进行评价，避免发布个人隐私、攻击性内容或未经证实的信息。
          </p>
        </div>
        <StarRating value={rating} onChange={setRating} />
      </div>

      <label className="mt-4 block">
        <span className="field-label">文字评价（选填）</span>
        <textarea
          className="field-control min-h-[104px] resize-y"
          value={content}
          maxLength={500}
          onChange={(event) => {
            setContent(event.target.value);
            setErrorMessage("");
          }}
          placeholder="可以写下课程体验、信息公开程度、学院支持、校园资源等真实感受"
        />
        <span className="mt-1 block text-right text-xs text-slate-400">{content.length}/500</span>
      </label>

      {errorMessage && <p className="mt-2 text-sm font-semibold text-red-600">{errorMessage}</p>}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {currentReview && (
          <button
            type="button"
            className="btn-secondary border-red-200 text-red-600 hover:border-red-300 hover:text-red-700"
            onClick={handleDelete}
            disabled={submitting || deleting}
          >
            {deleting ? "删除中..." : "删除评价"}
          </button>
        )}
        <button
          type="button"
          className="btn-primary disabled:cursor-not-allowed disabled:bg-slate-300"
          onClick={handleSubmit}
          disabled={submitting || deleting}
        >
          {submitting ? "提交中..." : currentReview ? "保存评价" : "提交评价"}
        </button>
      </div>
    </div>
  );
}
