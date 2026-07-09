export const initialAssessmentForm = {
  grade: "大三上",
  major: "计算机科学与技术",
  schoolTier: "211/双一流",
  gpa: "3.72",
  rank: "前 12%",
  english: "CET-6 548",
  research:
    "参与省级大创项目，负责数据处理和模型评估，正在整理实验报告。",
  competitions: "蓝桥杯省一，数学建模校赛一等奖。",
  leadership: "担任学习委员，组织过课程资料共建和保研经验分享。",
  internship: "有一段暑期算法实习，参与推荐系统离线评估。",
  targetTier: "985/强势双一流",
  targetMajor: "人工智能",
  concerns: "担心论文产出不足，目标院校梯度不清晰，面试表达还不稳定。",
};

export const gradeOptions = ["大一", "大二", "大三上", "大三下", "大四"];
export const schoolTierOptions = ["普通本科", "特色强校", "211/双一流", "985/强势双一流", "顶尖985"];
export const targetTierOptions = ["稳妥211/双一流", "985/强势双一流", "顶尖985", "混合梯度"];

const tierScore = {
  普通本科: 8,
  特色强校: 12,
  "211/双一流": 16,
  "985/强势双一流": 20,
  顶尖985: 24,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreGpa(raw) {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 12;
  const normalized = value > 4.3 ? value / 5 : value / 4;
  return clamp(Math.round(normalized * 24), 8, 24);
}

function scoreRank(raw) {
  if (!raw) return 8;
  const percentMatch = raw.match(/(\d+(\.\d+)?)\s*%/);
  if (percentMatch) {
    const percent = Number.parseFloat(percentMatch[1]);
    if (percent <= 5) return 18;
    if (percent <= 10) return 16;
    if (percent <= 20) return 13;
    return 9;
  }
  const ratioMatch = raw.match(/(\d+)\s*[/／]\s*(\d+)/);
  if (ratioMatch) {
    const rank = Number.parseInt(ratioMatch[1], 10);
    const total = Number.parseInt(ratioMatch[2], 10);
    return scoreRank(`${Math.round((rank / total) * 100)}%`);
  }
  if (raw.includes("前")) return 13;
  return 10;
}

function textScore(text, maxScore) {
  const length = (text || "").trim().length;
  if (length === 0) return 0;
  if (length < 12) return Math.round(maxScore * 0.35);
  if (length < 36) return Math.round(maxScore * 0.65);
  return maxScore;
}

function englishScore(text) {
  if (!text) return 6;
  const scoreMatch = text.match(/\d{3}/);
  const score = scoreMatch ? Number.parseInt(scoreMatch[0], 10) : 0;
  if (/雅思|IELTS/i.test(text)) return 16;
  if (/托福|TOEFL/i.test(text)) return 16;
  if (score >= 560) return 16;
  if (score >= 500) return 13;
  if (score >= 425) return 10;
  return 8;
}

function inferLevel(score) {
  if (score >= 82) return "冲刺高竞争项目";
  if (score >= 68) return "具备较强申请竞争力";
  if (score >= 54) return "基础可用，需集中补短板";
  return "需要先建立保研安全线";
}

export function analyzeProfile(form) {
  const academic = scoreGpa(form.gpa) + scoreRank(form.rank);
  const background = tierScore[form.schoolTier] ?? 10;
  const language = englishScore(form.english);
  const research = textScore(form.research, 14);
  const competition = textScore(form.competitions, 10);
  const practice = textScore(form.internship, 8) + textScore(form.leadership, 6);
  const rawScore = academic + background + language + research + competition + practice;
  const score = clamp(Math.round(rawScore), 35, 96);

  const strengths = [];
  const weaknesses = [];

  if (academic >= 32) strengths.push("绩点与排名能够支撑材料初筛，是当前最稳定的底盘。");
  else weaknesses.push("学业硬指标还需要继续抬升，优先保障核心课和专业排名。");

  if (research >= 10) strengths.push("已有科研项目经历，可继续打磨为面试中的研究主线。");
  else weaknesses.push("科研叙事偏弱，建议尽快形成一个可完整讲清的问题和方法。");

  if (competition >= 7) strengths.push("竞赛经历能证明专业投入度，适合补充材料亮点。");
  else weaknesses.push("竞赛或可验证成果不足，材料中可展示的外部认可还不够。");

  if (language >= 13) strengths.push("英语成绩具备申请多数项目的支撑能力。");
  else weaknesses.push("英语成绩存在不确定性，需准备补充分数或英文面试表达。");

  if (practice >= 10) strengths.push("学生工作和实践经历能体现执行力与协作能力。");
  else weaknesses.push("实践经历需要进一步结构化，避免材料显得只有课程成绩。");

  const targetAggressive = ["顶尖985", "985/强势双一流"].includes(form.targetTier);
  const profile =
    score >= 82
      ? "高潜力冲刺型申请者"
      : score >= 68
        ? "均衡提升型申请者"
        : score >= 54
          ? "短板突破型申请者"
          : "基础建设型申请者";

  const recommendedPath = targetAggressive
    ? [
        "采用“冲刺 + 匹配 + 保底”三档院校梯度，不把申请集中在单一层次。",
        "优先联系目标方向导师或课题组，确认研究方向是否有真实匹配点。",
        "把科研或项目经历压缩成 90 秒版本和 5 分钟版本，分别用于自我介绍和追问。",
      ]
    : [
        "先锁定与自身排名和专业背景匹配的稳妥院校，再配置少量冲刺项目。",
        "材料重点强调稳定性、专业基础和持续投入，而不是堆砌经历数量。",
        "提前准备九月推免备选方案，避免夏令营结果波动影响节奏。",
      ];

  const plan = [
    "第 1 周：整理成绩单、排名证明、简历和个人陈述，建立目标院校表。",
    "第 2 周：把科研、竞赛或实习经历拆成 STAR 框架，补充可量化结果。",
    "第 3 周：完成 6-8 所院校的信息筛选，记录导师方向、申请类型和材料要求。",
    "第 4 周：进行 2 次模拟面试，重点训练自我介绍、项目追问和英文问答。",
  ];

  const risks = [
    "模拟结果只反映当前输入信息，不代表任何院校真实录取概率。",
    "目标院校越集中在高竞争层次，越需要准备同方向替代项目。",
    form.concerns
      ? `当前困惑需要优先拆解：${form.concerns.slice(0, 48)}${form.concerns.length > 48 ? "..." : ""}`
      : "如果没有明确困惑，建议先从目标专业、院校梯度和材料短板三项自查。",
  ];

  return {
    score,
    level: inferLevel(score),
    profile,
    summary: `你目前更接近“${profile}”。申请 ${form.targetTier} 的 ${form.targetMajor || form.major} 方向时，建议用硬指标稳住初筛，用一条清晰经历主线提升面试辨识度。`,
    strengths: strengths.length ? strengths.slice(0, 4) : ["当前信息较少，建议先补全核心履历再评估优势。"],
    weaknesses: weaknesses.length ? weaknesses.slice(0, 4) : ["短板不明显，下一步重点是提升材料表达和院校匹配精度。"],
    recommendedPath,
    plan,
    risks,
  };
}
