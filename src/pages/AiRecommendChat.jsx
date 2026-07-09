import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  MessageSquareText,
  Send,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import {
  analyzeRecommendBackground,
  backgroundFields,
} from "../utils/aiRecommend.js";

const completeSample =
  "我是大三上，计算机科学与技术专业，学校层次是 211/双一流，GPA 3.72/4.0，专业排名前 12%，英语 CET-6 548。科研经历是参加省级大创项目，负责数据处理和模型评估，正在整理实验报告。竞赛经历有蓝桥杯省一、数学建模校赛一等奖。目标专业方向是人工智能，意向城市是北京、上海、杭州，风险偏好是均衡，愿意保留 2-3 所冲刺院校。";

const partialSample = "我是大三，计算机专业，想申请人工智能方向，最好在北京或上海。";

const initialMessages = [
  {
    id: "welcome",
    role: "assistant",
    kind: "text",
    content:
      "你好，我是 AI 院校推荐助手。请先提供你的 background：年级、专业、学校层次、绩点或排名、英语成绩、科研经历、竞赛经历、目标专业方向、意向城市和风险偏好。信息不足时，我会先追问，再给出院校梯度建议。",
  },
];

function MessageAvatar({ role }) {
  const isAssistant = role === "assistant";

  return (
    <span
      className={[
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
        isAssistant ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700",
      ].join(" ")}
    >
      {isAssistant ? <Bot size={18} aria-hidden="true" /> : <UserRound size={18} aria-hidden="true" />}
    </span>
  );
}

function TextMessage({ message }) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}>
      {isAssistant && <MessageAvatar role={message.role} />}
      <div
        className={[
          "max-w-[min(760px,85%)] rounded-lg px-4 py-3 text-sm leading-7 shadow-sm",
          isAssistant
            ? "border border-slate-200 bg-white text-slate-700"
            : "bg-brand-600 text-white",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.missingFields?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.missingFields.map((field) => (
              <span key={field.key} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                {field.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {!isAssistant && <MessageAvatar role={message.role} />}
    </div>
  );
}

function ChatMessage({ message }) {
  return <TextMessage message={message} />;
}

async function requestAiRecommendation(messages) {
  const payloadMessages = messages
    .filter((message) => ["user", "assistant"].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const response = await fetch("/api/recommend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages: payloadMessages }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "AI 服务暂时不可用，请稍后重试。");
  }

  if (!data.reply) {
    throw new Error("AI 服务没有返回有效内容。");
  }

  return data.reply;
}

function BackgroundPromptCard({ coverage, onUseCompleteSample, onUsePartialSample }) {
  const detectedKeys = new Set(coverage.detected.map((field) => field.key));

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-700">背景信息提示</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">推荐前需要确认这些信息</h2>
        </div>
        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-brand-700">
          {coverage.percent}%
        </span>
      </div>

      <div className="grid gap-2">
        {backgroundFields.map((field) => {
          const done = detectedKeys.has(field.key);
          return (
            <div key={field.key} className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <CheckCircle2
                className={`mt-0.5 h-4 w-4 shrink-0 ${done ? "text-brand-700" : "text-slate-300"}`}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold text-slate-900">{field.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{field.hint}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-2">
        <button type="button" className="btn-secondary w-full" onClick={onUseCompleteSample}>
          填入完整示例
        </button>
        <button type="button" className="btn-secondary w-full" onClick={onUsePartialSample}>
          填入追问示例
        </button>
      </div>
    </Card>
  );
}

export default function AiRecommendChat() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef(null);

  const userText = useMemo(
    () => messages.filter((message) => message.role === "user").map((message) => message.content).join("\n"),
    [messages],
  );

  const coverage = useMemo(() => analyzeRecommendBackground(`${userText}\n${input}`), [input, userText]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isThinking) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      kind: "text",
      content,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsThinking(true);

    try {
      const reply = await requestAiRecommendation(nextMessages);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: reply,
        },
      ]);
    } catch (requestError) {
      const errorMessage = requestError instanceof Error ? requestError.message : "AI 服务暂时不可用，请稍后重试。";
      setError(errorMessage);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: `接口调用失败：${errorMessage}`,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <CardHeader
            eyebrow="AI 院校推荐助手"
            title="用聊天方式生成保研院校梯度"
            description="先完成 background 信息确认，再由服务端调用 AI 生成用户画像、申请路径、三档院校建议、行动计划和风险提醒。"
          />
          <div className="flex w-fit items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-brand-700">
            <Sparkles size={17} aria-hidden="true" />
            DeepSeek API
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="flex min-h-[680px] flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-white">
                  <MessageSquareText size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-950">院校推荐对话</h2>
                  <p className="text-sm text-slate-500">服务端安全调用 AI API</p>
                </div>
              </div>
              <span className="hidden rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 sm:inline-flex">
                {coverage.detected.length}/{backgroundFields.length}
              </span>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50 px-4 py-5 sm:px-5">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isThinking && (
                <div className="flex gap-3">
                  <MessageAvatar role="assistant" />
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500 shadow-sm">
                    正在请求 AI 推荐...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block flex-1">
                  <span className="field-label">输入 background 或补充信息</span>
                  <textarea
                    className="field-control min-h-[96px] resize-y"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="例如：我是大三上，计算机专业，211，排名前 12%，六级 548..."
                  />
                </label>
                <button
                  type="button"
                  className="btn-primary disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-[46px]"
                  onClick={handleSend}
                  disabled={!input.trim() || isThinking}
                >
                  <Send size={18} aria-hidden="true" />
                  {isThinking ? "发送中" : "发送"}
                </button>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <BackgroundPromptCard
              coverage={coverage}
              onUseCompleteSample={() => setInput(completeSample)}
              onUsePartialSample={() => setInput(partialSample)}
            />

            <Card className="border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                <div>
                  <h2 className="font-bold text-slate-950">边界说明</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    推荐结果仅供规划参考，具体以学校官网最新通知为准。本助手不承诺保研成功，也不做绝对录取判断。
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
