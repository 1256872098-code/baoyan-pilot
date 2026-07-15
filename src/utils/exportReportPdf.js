import { downloadRecommendationPdf } from "./recommendationPdf.js";

export async function exportReportPdf({ reportContent, reportElement, title, fileName }) {
  const content = String(reportContent || reportElement?.innerText || "").trim();

  if (!content) {
    throw new Error("没有可导出的报告内容。");
  }

  downloadRecommendationPdf({
    content,
    title: fileName || title || "BaoyanPilot保研院校梯度规划报告",
  });
}
