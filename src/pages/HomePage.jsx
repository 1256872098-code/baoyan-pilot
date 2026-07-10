import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  Database,
  GraduationCap,
  MessagesSquare,
  Route,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, StatCard } from "../components/Card.jsx";

const features = [
  {
    title: "保研画像评估",
    text: "整合成绩、排名、科研、竞赛、实践和目标方向，形成阶段性准备度判断。",
    icon: ClipboardList,
  },
  {
    title: "院校资料库",
    text: "按院校层次和专业方向筛选，快速建立申请目标池。",
    icon: Database,
  },
  {
    title: "行动路径规划",
    text: "把模糊目标拆解为材料准备、面试训练、导师匹配和短期行动计划。",
    icon: Route,
  },
  {
    title: "保研论坛",
    text: "浏览和发布保研经验、院校信息、材料准备和面试交流帖。",
    icon: MessagesSquare,
  },
];

const steps = [
  "填写个人背景和目标",
  "生成准备度与短板分析",
  "筛选匹配院校和项目",
  "执行 30 天行动计划",
];

export default function HomePage() {
  return (
    <div>
      <section
        className="hero-shell relative overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(248,250,252,0.98) 0%, rgba(248,250,252,0.9) 38%, rgba(248,250,252,0.42) 74%, rgba(248,250,252,0.18) 100%), url('/images/hero-planning.png')",
        }}
      >
        <div className="container-page hero-shell flex items-center py-10 sm:py-14">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-blue-100 bg-white/85 px-3 py-2 text-sm font-semibold text-brand-700 shadow-sm">
              <Sparkles size={16} aria-hidden="true" />
              面向大学生的 AI 保研规划助手
            </div>
            <h1 className="text-3xl font-bold tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              保研领航员
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-700 sm:text-lg">
              从个人画像、院校筛选到短期行动计划，帮助你把保研准备从“信息很多但没方向”
              变成“知道下一步该做什么”。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/assessment" className="btn-primary">
                开始使用
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/schools" className="btn-secondary">
                浏览院校资料库
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container-page">
          <div className="mb-12 grid gap-3 sm:grid-cols-3">
            <StatCard value="4" label="核心模块" helper="规划、院校、社区闭环" />
            <StatCard value="30天" label="行动计划" helper="聚焦近期可执行任务" tone="teal" />
            <StatCard value="AI" label="DeepSeek 接入" helper="院校推荐助手已支持真实对话" tone="amber" />
          </div>
          <CardHeader
            eyebrow="核心功能"
            title="围绕保研关键决策做规划"
            description="覆盖个人评估、目标筛选、AI 院校推荐、论坛交流和行动计划。"
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-brand-700">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-slate-950">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{feature.text}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <CardHeader
              eyebrow="使用流程"
              title="从输入到执行，四步完成一次规划"
              description="每次评估都会输出可复盘的结论，你可以随着成绩、经历和目标变化重新生成。"
            />
            <Link to="/assessment" className="btn-primary mt-8">
              立即生成画像
              <GraduationCap size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-4">
            {steps.map((step, index) => (
              <Card key={step} className="flex items-center gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-bold text-slate-950">{step}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {index === 0 && "填写当前阶段、学校层次、成绩排名和经历信息。"}
                    {index === 1 && "查看准备度、人物画像、优势短板和风险提醒。"}
                    {index === 2 && "通过资料库筛选冲刺、匹配和稳妥院校。"}
                    {index === 3 && "把规划落到未来 30 天任务和申请准备安排。"}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="container-page">
          <Card className="grid gap-6 border-amber-200 bg-amber-50 p-6 md:grid-cols-[auto_1fr]">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-amber-700">
              <ShieldAlert size={22} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-950">免责声明</h2>
              <p className="mt-3 leading-7 text-slate-700">
                保研领航员基于用户输入和规划规则生成辅助建议，
                不代表任何高校、学院或导师的官方意见，也不构成录取承诺。申请结果会受到招生政策、
                名额、材料真实性、面试表现和竞争环境等因素影响，请以各院校官方通知为准。
              </p>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
