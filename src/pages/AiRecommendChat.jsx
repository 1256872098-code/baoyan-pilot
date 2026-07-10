import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  MessageSquareText,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import {
  analyzeRecommendBackground,
  backgroundFields,
} from "../utils/aiRecommend.js";

const simpleSample = "我是大二，会计专业，普通一本，绩点 3.8，想去上海或江浙地区。";

const completeSample =
  "我是大二，会计专业，普通一本，GPA 3.85/4.00，专业排名前 8%，四级 600，六级 570，有一项大创和两项商赛经历，想申请经管类方向，优先上海、杭州、南京，风险偏好稳妥。";

const STORAGE_KEY = "baoyanpilot_ai_chat_messages";

const legacyWelcomeContent =
  "你好，我是 AI 院校推荐助手。请先提供你的 background：年级、专业、学校层次、绩点或排名、英语成绩、科研经历、竞赛经历、目标专业方向、意向城市和风险偏好。信息不足时，我会先追问，再给出院校梯度建议。";

const welcomeContent = `你好，我是 BaoyanPilot 的 AI 院校推荐助手，主要帮你根据本科背景、成绩排名、英语水平、科研竞赛经历和目标地区，初步判断适合关注哪些夏令营、预推免或九推院校。

为了先了解你的基本情况，我想先问你两个问题：

1. 你现在是大几，学什么专业？
2. 你的本科学校大概是什么层次？例如 985、211、双一流、普通一本、普通二本，或者财经类/农林类/语言类等特色院校。

你可以直接像聊天一样回答，例如：
我是大二，会计专业，普通一本，绩点 3.8，想去上海或江浙地区。`;

const initialMessages = [
  {
    id: "welcome",
    role: "assistant",
    kind: "text",
    content: welcomeContent,
  },
];

function normalizeStoredMessages(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((message) => ["user", "assistant"].includes(message?.role) && typeof message?.content === "string")
    .map((message, index) => ({
      id: message.id || `stored-${index}`,
      role: message.role,
      kind: message.kind || "text",
      content: message.content,
    }));
}

function loadInitialMessages() {
  if (typeof window === "undefined") {
    return initialMessages;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return initialMessages;
    }

    const parsed = normalizeStoredMessages(JSON.parse(stored));
    if (parsed.length === 1 && parsed[0].id === "welcome" && parsed[0].content === legacyWelcomeContent) {
      return initialMessages;
    }

    return parsed.length ? parsed : initialMessages;
  } catch {
    return initialMessages;
  }
}

function saveMessages(messages) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Ignore localStorage write errors so chat can still work in restricted browsers.
  }
}

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

function MarkdownContent({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mb-3 mt-1 text-xl font-bold leading-8 text-slate-950">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-bold leading-7 text-slate-950">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-3 text-base font-bold leading-7 text-slate-950">{children}</h3>,
        p: ({ children }) => <p className="my-2 leading-7 text-slate-700">{children}</p>,
        strong: ({ children }) => <strong className="font-bold text-slate-950">{children}</strong>,
        ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-slate-700">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-slate-700">{children}</ol>,
        li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-4 border-blue-200 bg-blue-50 px-4 py-2 text-slate-700">
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a
            className="font-semibold text-brand-700 underline decoration-blue-200 underline-offset-4 hover:text-brand-600"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.9em] font-semibold text-slate-800">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-800">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse bg-white text-left text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border-b border-slate-200 bg-blue-50 px-3 py-2 font-bold text-slate-900">{children}</th>,
        td: ({ children }) => <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-700">{children}</td>,
        hr: () => <hr className="my-4 border-slate-200" />,
      }}
    >
      {content}
    </ReactMarkdown>
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
        {isAssistant ? (
          <MarkdownContent content={message.content} />
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
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

function BackgroundPromptCard({ coverage, onUseCompleteSample, onUseSimpleSample }) {
  const detectedKeys = new Set(coverage.detected.map((field) => field.key));

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-700">背景信息提示</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">可以逐步补充这些信息</h2>
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
        <button type="button" className="btn-secondary w-full" onClick={onUseSimpleSample}>
          填入简单示例
        </button>
        <button type="button" className="btn-secondary w-full" onClick={onUseCompleteSample}>
          填入完整示例
        </button>
      </div>
    </Card>
  );
}

export default function AiRecommendChat() {
  const [messages, setMessages] = useState(loadInitialMessages);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef(null);
  const skipNextSaveRef = useRef(false);

  const userText = useMemo(
    () => messages.filter((message) => message.role === "user").map((message) => message.content).join("\n"),
    [messages],
  );

  const coverage = useMemo(() => analyzeRecommendBackground(`${userText}\n${input}`), [input, userText]);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  const handleClearMessages = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    skipNextSaveRef.current = true;
    setMessages(initialMessages);
    setInput("");
    setError("");
  };

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
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-white">
                  <MessageSquareText size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-950">院校推荐对话</h2>
                  <p className="text-sm text-slate-500">服务端安全调用 AI API</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                  {coverage.detected.length}/{backgroundFields.length}
                </span>
                <button type="button" className="btn-secondary px-3 py-2" onClick={handleClearMessages}>
                  <Trash2 size={16} aria-hidden="true" />
                  清空对话
                </button>
              </div>
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
                    placeholder="例如：我是大二，会计专业，普通一本，绩点 3.8，想去上海或江浙地区。"
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
              onUseSimpleSample={() => setInput(simpleSample)}
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
