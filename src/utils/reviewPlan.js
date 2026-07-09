export const initialReviewForm = {
  course: "数据结构",
  scope: "线性表、栈和队列、树与二叉树、图、排序、查找、复杂度分析",
  days: 10,
  weakPoints: "图算法、平衡二叉树、排序稳定性、代码题时间控制",
};

function splitItems(text) {
  return (text || "")
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function generateReviewPlan(form) {
  const days = Math.max(1, Math.min(Number.parseInt(form.days, 10) || 7, 45));
  const scopes = splitItems(form.scope);
  const weakPoints = splitItems(form.weakPoints);
  const course = form.course || "当前课程";

  const phaseOneDays = Math.max(1, Math.floor(days * 0.35));
  const phaseTwoDays = days >= 3 ? Math.max(1, Math.floor(days * 0.4)) : Math.max(0, days - phaseOneDays);
  const phaseThreeDays = Math.max(0, days - phaseOneDays - phaseTwoDays);

  const rangeLabel = (start, count) => {
    const end = start + count - 1;
    return start === end ? `第 ${start} 天` : `第 ${start}-${end} 天`;
  };

  const phases = [
    {
      title: "基础回收",
      range: rangeLabel(1, phaseOneDays),
      detail: "按考试范围快速过一遍概念、公式、定义和典型例题，建立可复述的知识清单。",
    },
    phaseTwoDays > 0
      ? {
          title: "专题突破",
          range: rangeLabel(phaseOneDays + 1, phaseTwoDays),
          detail: "围绕薄弱点和高频题型做专项训练，记录错因并形成二刷题单。",
        }
      : null,
    phaseThreeDays > 0
      ? {
          title: "模拟冲刺",
          range: rangeLabel(phaseOneDays + phaseTwoDays + 1, phaseThreeDays),
          detail: "进行限时套卷或综合题训练，回看错题、默写框架、压缩考前材料。",
        }
      : null,
  ].filter(Boolean);

  const dailyPlan = Array.from({ length: Math.min(days, 7) }, (_, index) => {
    const scope = scopes[index % Math.max(scopes.length, 1)] || `${course}核心章节`;
    const weak = weakPoints[index % Math.max(weakPoints.length, 1)] || "易错题型";
    const phaseTitle =
      index < phaseOneDays
        ? `梳理 ${scope}`
        : index < phaseOneDays + phaseTwoDays
          ? `突破 ${weak}`
          : "限时模拟与错题回看";
    return {
      day: `Day ${index + 1}`,
      title: phaseTitle,
      tasks: [
        "30 分钟回顾课件和笔记，写出本章知识框架。",
        "完成 8-12 道代表题，标记不会做和做得慢的题。",
        "用 10 分钟复盘错因，沉淀到考前速查清单。",
      ],
    };
  });

  const methods = [
    "每天保留固定复盘窗口，不把错题复盘挤到考前一天。",
    "薄弱点优先做中等难度题，先保证稳定得分，再追求难题突破。",
    "所有公式、定义和算法步骤都要能脱离资料复述一遍。",
  ];

  const warnings = [
    days <= 3
      ? "剩余时间很短，优先保住高频题和基础分，不建议大范围扩展新内容。"
      : "不要平均用力，薄弱点和高频章节需要获得更多练习时间。",
    "模拟计划基于你输入的信息生成，真实复习节奏仍需按课程要求调整。",
  ];

  return {
    summary: `${course} 还有 ${days} 天复习时间，建议采用“基础回收 - 专题突破 - 模拟冲刺”的节奏。`,
    phases,
    dailyPlan,
    methods,
    warnings,
  };
}
