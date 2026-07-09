import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  RefreshCw,
  Route,
  UserRound,
} from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import { SelectField, TextAreaField, TextField } from "../components/FormControls.jsx";
import ResultSection from "../components/ResultSection.jsx";
import {
  analyzeProfile,
  gradeOptions,
  initialAssessmentForm,
  schoolTierOptions,
  targetTierOptions,
} from "../utils/assessment.js";

function ScoreMeter({ score, level }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-700">综合准备度</p>
          <p className="mt-2 text-4xl font-bold text-slate-950">{score}</p>
        </div>
        <span className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-brand-700">
          {level}
        </span>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-md bg-white">
        <div className="h-full rounded-md bg-brand-600" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function BulletList({ items, tone = "slate" }) {
  const color = tone === "risk" ? "text-amber-700" : tone === "good" ? "text-emerald-700" : "text-brand-700";
  return (
    <ul className="space-y-2 text-sm leading-6 text-slate-600">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AssessmentPage() {
  const [form, setForm] = useState(initialAssessmentForm);
  const [analysis, setAnalysis] = useState(() => analyzeProfile(initialAssessmentForm));
  const [updatedAt, setUpdatedAt] = useState("已生成示例结果");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const completion = useMemo(() => {
    const values = Object.values(form);
    const filled = values.filter((value) => String(value).trim()).length;
    return Math.round((filled / values.length) * 100);
  }, [form]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setAnalysis(analyzeProfile(form));
    setUpdatedAt(`已根据当前 ${completion}% 信息完整度更新`);
  };

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <CardHeader
          eyebrow="保研画像评估"
          title="把零散经历转成清晰申请画像"
          description="填写当前阶段、硬指标、经历和目标方向，右侧会用模拟规则生成准备度、优势短板、路径建议和未来 30 天行动计划。"
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.05fr]">
          <Card className="p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">个人信息表</h2>
                <p className="mt-1 text-sm text-slate-500">信息完整度 {completion}%</p>
              </div>
              <ClipboardList className="text-brand-700" size={24} aria-hidden="true" />
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="年级" name="grade" value={form.grade} onChange={handleChange} options={gradeOptions} />
                <TextField label="专业" name="major" value={form.major} onChange={handleChange} placeholder="例如：计算机科学与技术" />
                <SelectField
                  label="学校层次"
                  name="schoolTier"
                  value={form.schoolTier}
                  onChange={handleChange}
                  options={schoolTierOptions}
                />
                <TextField label="绩点" name="gpa" value={form.gpa} onChange={handleChange} placeholder="例如：3.72 / 4.0" />
                <TextField label="专业排名" name="rank" value={form.rank} onChange={handleChange} placeholder="例如：前 10% / 5/120" />
                <TextField label="英语成绩" name="english" value={form.english} onChange={handleChange} placeholder="例如：CET-6 548" />
                <SelectField
                  label="目标院校层次"
                  name="targetTier"
                  value={form.targetTier}
                  onChange={handleChange}
                  options={targetTierOptions}
                />
                <TextField label="目标专业" name="targetMajor" value={form.targetMajor} onChange={handleChange} placeholder="例如：人工智能" />
              </div>

              <TextAreaField label="科研经历" name="research" value={form.research} onChange={handleChange} placeholder="项目名称、职责、方法、阶段成果" />
              <TextAreaField label="竞赛经历" name="competitions" value={form.competitions} onChange={handleChange} placeholder="竞赛名称、奖项、负责内容" rows={3} />
              <TextAreaField label="学生工作" name="leadership" value={form.leadership} onChange={handleChange} placeholder="组织经历、服务对象、结果" rows={3} />
              <TextAreaField label="实习实践" name="internship" value={form.internship} onChange={handleChange} placeholder="实习岗位、项目任务、产出" rows={3} />
              <TextAreaField label="当前困惑" name="concerns" value={form.concerns} onChange={handleChange} placeholder="例如：目标不清晰、论文不足、面试紧张" rows={3} />

              <button type="submit" className="btn-primary w-full">
                <RefreshCw size={18} aria-hidden="true" />
                生成分析结果
              </button>
            </form>
          </Card>

          <div className="space-y-4">
            <ScoreMeter score={analysis.score} level={analysis.level} />
            <p className="text-sm font-medium text-slate-500">{updatedAt}</p>

            <ResultSection title="人物画像" icon={UserRound}>
              <p className="text-sm leading-7 text-slate-600">
                <span className="font-semibold text-slate-900">{analysis.profile}：</span>
                {analysis.summary}
              </p>
            </ResultSection>

            <div className="grid gap-4 md:grid-cols-2">
              <ResultSection title="核心优势" icon={CheckCircle2}>
                <BulletList items={analysis.strengths} tone="good" />
              </ResultSection>
              <ResultSection title="主要短板" icon={AlertTriangle}>
                <BulletList items={analysis.weaknesses} tone="risk" />
              </ResultSection>
            </div>

            <ResultSection title="推荐路径" icon={Route}>
              <BulletList items={analysis.recommendedPath} />
            </ResultSection>

            <ResultSection title="未来 30 天行动计划" icon={BarChart3}>
              <div className="grid gap-3">
                {analysis.plan.map((item) => (
                  <div key={item} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </ResultSection>

            <ResultSection title="风险提醒" icon={Lightbulb}>
              <BulletList items={analysis.risks} tone="risk" />
            </ResultSection>
          </div>
        </div>
      </div>
    </div>
  );
}
