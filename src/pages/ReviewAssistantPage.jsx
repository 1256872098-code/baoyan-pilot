import React, { useState } from "react";
import { BookOpenCheck, CalendarDays, CheckCircle2, Clock, RefreshCw, ShieldAlert } from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import { TextAreaField, TextField } from "../components/FormControls.jsx";
import ResultSection from "../components/ResultSection.jsx";
import { generateReviewPlan, initialReviewForm } from "../utils/reviewPlan.js";

function List({ items }) {
  return (
    <ul className="space-y-2 text-sm leading-6 text-slate-600">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReviewAssistantPage() {
  const [form, setForm] = useState(initialReviewForm);
  const [plan, setPlan] = useState(() => generateReviewPlan(initialReviewForm));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setPlan(generateReviewPlan(form));
  };

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <CardHeader
          eyebrow="期末复习助手"
          title="把复习压力拆成每天能完成的计划"
          description="输入课程名称、考试范围、剩余天数和薄弱点，系统会生成阶段安排、每日任务和风险提醒。"
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">复习信息</h2>
                <p className="mt-1 text-sm text-slate-500">用当前课程要求生成一版模拟计划</p>
              </div>
              <BookOpenCheck className="text-brand-700" size={24} aria-hidden="true" />
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <TextField label="课程名称" name="course" value={form.course} onChange={handleChange} placeholder="例如：数据结构" />
              <TextAreaField
                label="考试范围"
                name="scope"
                value={form.scope}
                onChange={handleChange}
                placeholder="例如：第一章到第六章、重点专题、题型范围"
              />
              <TextField
                label="剩余天数"
                name="days"
                type="number"
                min="1"
                max="45"
                value={form.days}
                onChange={handleChange}
                placeholder="例如：10"
              />
              <TextAreaField
                label="薄弱点"
                name="weakPoints"
                value={form.weakPoints}
                onChange={handleChange}
                placeholder="例如：图算法、证明题、公式记忆"
              />
              <button type="submit" className="btn-primary w-full">
                <RefreshCw size={18} aria-hidden="true" />
                生成复习计划
              </button>
            </form>
          </Card>

          <div className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                <Clock size={17} aria-hidden="true" />
                计划摘要
              </div>
              <p className="mt-3 text-lg font-bold leading-8 text-slate-950">{plan.summary}</p>
            </div>

            <ResultSection title="阶段安排" icon={CalendarDays}>
              <div className="grid gap-3">
                {plan.phases.map((phase) => (
                  <div key={phase.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-bold text-slate-950">{phase.title}</h3>
                      <span className="text-sm font-semibold text-brand-700">{phase.range}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{phase.detail}</p>
                  </div>
                ))}
              </div>
            </ResultSection>

            <ResultSection title="每日任务预览" icon={BookOpenCheck}>
              <div className="grid gap-3">
                {plan.dailyPlan.map((day) => (
                  <div key={day.day} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">
                        {day.day}
                      </span>
                      <h3 className="font-bold text-slate-950">{day.title}</h3>
                    </div>
                    <div className="mt-3">
                      <List items={day.tasks} />
                    </div>
                  </div>
                ))}
              </div>
              {Number(form.days) > 7 && (
                <p className="mt-3 text-sm text-slate-500">页面展示前 7 天任务，其余天数按阶段安排继续滚动执行。</p>
              )}
            </ResultSection>

            <ResultSection title="复习方法" icon={CheckCircle2}>
              <List items={plan.methods} />
            </ResultSection>

            <ResultSection title="风险提醒" icon={ShieldAlert}>
              <List items={plan.warnings} />
            </ResultSection>
          </div>
        </div>
      </div>
    </div>
  );
}
