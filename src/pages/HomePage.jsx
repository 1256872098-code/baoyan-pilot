import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Database,
  GraduationCap,
  MessagesSquare,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Card, CardHeader, StatCard } from "../components/Card.jsx";

const features = [
  {
    title: "AI院校推荐助手",
    text: "通过聊天逐步补全学校、专业、成绩、英语、科研竞赛和地区偏好，生成院校梯度建议。",
    icon: Bot,
  },
  {
    title: "院校资料库",
    text: "按地区和院校层次筛选推免资格高校，进入学校与学院目录查看后续资料框架。",
    icon: Database,
  },
  {
    title: "保研论坛",
    text: "浏览和发布保研经验、院校信息、材料准备、预推免和面试交流帖。",
    icon: MessagesSquare,
  },
  {
    title: "个人中心",
    text: "管理昵称、头像、学校、专业和 AI 历史对话等本地体验数据。",
    icon: UserRound,
  },
];

const steps = [
  {
    title: "进入AI院校推荐",
    text: "像聊天一样说明年级、专业、本科院校和目标地区，不需要一次性填表。",
  },
  {
    title: "补全关键背景",
    text: "AI 会按需追问绩点排名、英语成绩、科研竞赛、论文实习和风险偏好。",
  },
  {
    title: "查看院校梯度建议",
    text: "在信息足够后，获得冲刺、匹配、稳妥三个梯度的规划参考。",
  },
  {
    title: "结合资料库继续核对",
    text: "进入院校资料库和学校详情页，按官方来源持续补充申请信息。",
  },
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
              从 AI 院校推荐、院校资料库到保研论坛，帮助你把分散信息整理成可执行的保研规划。
              推荐结果仅供规划参考，具体政策和报名要求以学校官网最新通知为准。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/ai-recommend" className="btn-primary">
                开始AI院校推荐
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
            <StatCard value="AI" label="院校推荐" helper="DeepSeek 对话式规划建议" />
            <StatCard value="427" label="推免资格高校" helper="院校资料持续补全中" tone="teal" />
            <StatCard value="论坛" label="经验交流" helper="帖子和回复接入 Supabase" tone="amber" />
          </div>
          <CardHeader
            eyebrow="核心功能"
            title="围绕保研择校和信息核对做规划"
            description="保留最常用的工具入口：AI 院校推荐、院校资料库、保研论坛和个人中心。"
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
              title="从聊天到资料核对，逐步建立目标院校池"
              description="AI 推荐负责启发式规划，院校资料库负责持续沉淀官方来源和学院目录。"
            />
            <Link to="/ai-recommend" className="btn-primary mt-8">
              开始AI院校推荐
              <GraduationCap size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-4">
            {steps.map((step, index) => (
              <Card key={step.title} className="flex items-center gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-bold text-slate-950">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
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
              <h2 className="text-xl font-bold text-slate-950">重要说明</h2>
              <p className="mt-3 leading-7 text-slate-700">
                BaoyanPilot 提供的是规划辅助和公开信息整理，不代表任何高校、学院或导师的官方意见，
                也不构成录取承诺。院校政策、报名时间、材料要求和考核方式可能变化，请以当年学校官网最新通知为准。
              </p>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
