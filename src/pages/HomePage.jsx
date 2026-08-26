import React from "react";
import { Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <section className="relative isolate h-[calc(100svh-4rem)] overflow-hidden bg-slate-50">
      <img
        src="/images/hero-planning-v2.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-[64%_center] sm:object-[60%_center] lg:object-center"
      />
      <div className="absolute inset-0 bg-white/70 sm:hidden" aria-hidden="true" />
      <div
        className="absolute inset-0 hidden sm:block"
        style={{
          background:
            "linear-gradient(90deg, rgba(248,250,252,0.98) 0%, rgba(248,250,252,0.93) 29%, rgba(248,250,252,0.58) 44%, rgba(248,250,252,0.08) 68%, rgba(248,250,252,0) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="container-page relative z-10 flex h-full items-center">
        <div className="max-w-[570px] pb-[4vh]">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-blue-100 bg-white/90 px-3.5 py-2.5 text-base font-semibold text-brand-700 shadow-sm backdrop-blur-sm sm:mb-6 lg:text-lg">
            <Sparkles size={18} aria-hidden="true" />
            面向大学生的 AI 保研规划助手
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-slate-950 sm:text-[64px] sm:leading-[1.1] lg:text-[72px]">保研领航员</h1>
          <p className="mt-5 text-lg leading-[1.7] text-slate-700 sm:mt-6 sm:text-xl lg:text-[22px]">
            聚合院校资料、推免政策、个人院校信息与保研经验交流，帮助你从信息检索、目标定位到备战规划，更清晰地完成保研准备。
          </p>
          <p className="mt-4 text-sm leading-[1.7] text-slate-500 sm:mt-5 sm:text-base">
            院校及推免信息持续更新，具体政策与报名要求请以各高校官网最新通知为准。
          </p>
        </div>
      </div>
    </section>
  );
}
