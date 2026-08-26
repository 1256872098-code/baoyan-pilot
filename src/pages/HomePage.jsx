import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

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
        <div className="max-w-xl pb-[6vh]">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-blue-100 bg-white/90 px-3 py-2 text-sm font-semibold text-brand-700 shadow-sm backdrop-blur-sm sm:mb-6">
            <Sparkles size={16} aria-hidden="true" />
            面向大学生的 AI 保研规划助手
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">保研领航员</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-700 sm:mt-6 sm:text-lg sm:leading-8">
            从 AI 院校推荐到保研论坛，帮助你把分散信息整理成可执行的保研规划。推荐结果仅供规划参考，具体政策和报名要求以学校官网最新通知为准。
          </p>

          <Link to="/ai-recommend" className="btn-primary mt-7 sm:mt-9">
            开始AI院校推荐
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
