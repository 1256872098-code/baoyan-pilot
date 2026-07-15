import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  CircleAlert,
  FileDown,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { Card } from "../components/Card.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getScopedStorageKey, LOCAL_GUEST_USER_ID } from "../utils/auth.js";
import { downloadRecommendationPdf, isRecommendationReportContent } from "../utils/recommendationPdf.js";

const LEGACY_MESSAGES_KEY = "baoyanpilot_ai_chat_messages";
const BASE_CONVERSATIONS_KEY = "baoyanpilot_ai_conversations";
const BASE_ACTIVE_CONVERSATION_KEY = "baoyanpilot_ai_active_conversation_id";
const DEFAULT_CONVERSATION_TITLE = "新的保研咨询";

const legacyWelcomeContent =
  "你好，我是 AI 院校推荐助手。请先提供你的 background：年级、专业、学校层次、绩点或排名、英语成绩、科研经历、竞赛经历、目标专业方向、意向城市和风险偏好。信息不足时，我会先追问，再给出院校梯度建议。";

const previousWelcomeContent = `你好，我是 BaoyanPilot 的 AI 院校推荐助手，主要帮你根据本科背景、成绩排名、英语水平、科研竞赛经历和目标地区，初步判断适合关注哪些夏令营、预推免或九推院校。

为了先了解你的基本情况，我想先问你两个问题：

1. 你现在是大几，学什么专业？
2. 你的本科学校大概是什么层次？例如 985、211、双一流、普通一本、普通二本，或者财经类/农林类等特色院校。

你可以直接像聊天一样回答，例如：
我是大二，会计专业，普通一本，绩点 3.8，想去上海或江浙地区。`;

const welcomeContent = `你好，我是 BaoyanPilot 的 AI 院校推荐助手。我会先帮你梳理保研背景，再根据你的成绩、学校层次、英语、竞赛科研、论文实习和目标地区，生成保研画像与院校梯度建议。

为了不让你一次性填太多信息，我们可以一步一步来。  
我先想了解两个基础问题：

1. 你现在是大几，学什么专业？
2. 你的本科院校是哪所？如果不方便说具体学校，也可以说学校层次，比如 985、211、双一流、普通一本、普通二本，或者财经类/农林类等特色院校。

你可以像聊天一样回答，例如：  
我是大二，会计专业，本科是普通一本，想先看看上海和江浙地区的保研机会。`;

const professionalWelcomeContent = `你好，我是 BaoyanPilot 的 AI 院校推荐助手。我会先帮你逐步核验保研背景，再生成一份结构化的「保研院校梯度规划报告」。

为了让推荐更专业，我不会在信息不足时直接给院校名单。我们会先补齐：年级专业、学校层次、GPA/排名、英语、科研竞赛、论文实习、目标方向、意向地区和风险偏好。

我先想确认两个基础问题：

1. 你现在是大几，学什么专业？
2. 你的本科院校是哪所？如果不方便说具体学校，也可以说学校层次，比如 985、211、双一流、普通一本、普通二本或特色院校。

你可以像聊天一样回答，例如：
我是大二，会计专业，本科普通一本，GPA 3.8/4.0，排名前 10%，想去上海或江浙地区。`;

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createWelcomeMessage() {
  return {
    id: createId("welcome"),
    role: "assistant",
    kind: "text",
    content: professionalWelcomeContent,
  };
}

function createConversation(overrides = {}) {
  const now = new Date().toISOString();

  return {
    id: createId("conversation"),
    title: DEFAULT_CONVERSATION_TITLE,
    messages: [createWelcomeMessage()],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

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

function normalizeConversation(value, index) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const messages = normalizeStoredMessages(value.messages);
  if (!messages.length) {
    return null;
  }

  const isOnlyOldWelcome =
    messages.length === 1 &&
    messages[0].role === "assistant" &&
    [legacyWelcomeContent, previousWelcomeContent, welcomeContent].includes(messages[0].content);

  const now = new Date().toISOString();
  return {
    id: String(value.id || `conversation-${index}`),
    title: String(value.title || DEFAULT_CONVERSATION_TITLE),
    messages: isOnlyOldWelcome ? [createWelcomeMessage()] : messages,
    createdAt: value.createdAt || now,
    updatedAt: value.updatedAt || value.createdAt || now,
  };
}

function createInitialConversationState() {
  const conversation = createConversation();
  return {
    conversations: [conversation],
    activeConversationId: conversation.id,
  };
}

function loadConversationState(user) {
  if (typeof window === "undefined") {
    return createInitialConversationState();
  }

  try {
    const conversationsKey = getScopedStorageKey(BASE_CONVERSATIONS_KEY, user);
    const activeConversationKey = getScopedStorageKey(BASE_ACTIVE_CONVERSATION_KEY, user);
    const userStoredConversations = window.localStorage.getItem(conversationsKey);
    const shouldReadLegacyConversationKeys = !user;
    const storedConversations =
      userStoredConversations ||
      (shouldReadLegacyConversationKeys ? window.localStorage.getItem(BASE_CONVERSATIONS_KEY) : null);

    if (storedConversations) {
      const conversations = JSON.parse(storedConversations)
        .map(normalizeConversation)
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      if (conversations.length) {
        const storedActiveId =
          window.localStorage.getItem(activeConversationKey) ||
          (shouldReadLegacyConversationKeys ? window.localStorage.getItem(BASE_ACTIVE_CONVERSATION_KEY) : null);
        const activeConversationId = conversations.some((conversation) => conversation.id === storedActiveId)
          ? storedActiveId
          : conversations[0].id;

        return { conversations, activeConversationId };
      }
    }

    const legacyStoredMessages = !user ? window.localStorage.getItem(LEGACY_MESSAGES_KEY) : null;
    if (legacyStoredMessages) {
      const legacyMessages = normalizeStoredMessages(JSON.parse(legacyStoredMessages));
      const isOnlyLegacyWelcome =
        legacyMessages.length === 1 && legacyMessages[0].id === "welcome" && legacyMessages[0].content === legacyWelcomeContent;

      if (legacyMessages.length && !isOnlyLegacyWelcome) {
        const conversation = createConversation({
          title: "历史保研咨询",
          messages: legacyMessages,
        });
        return {
          conversations: [conversation],
          activeConversationId: conversation.id,
        };
      }
    }

    return createInitialConversationState();
  } catch {
    return createInitialConversationState();
  }
}

function saveConversationState(conversations, activeConversationId, user) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getScopedStorageKey(BASE_CONVERSATIONS_KEY, user), JSON.stringify(conversations));
    window.localStorage.setItem(getScopedStorageKey(BASE_ACTIVE_CONVERSATION_KEY, user), activeConversationId);
  } catch {
    // Ignore localStorage write errors so chat can still work in restricted browsers.
  }
}

function createTitleFromMessage(content) {
  const compact = content.replace(/[，。！？、,.!?；;：:\s]/g, "");
  if (!compact) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  return compact.length > 18 ? `${compact.slice(0, 16)}...` : compact.slice(0, 18);
}

function formatConversationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
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
  const normalizedContent = useMemo(() => {
    const value = String(content || "");
    if (isRecommendationReportContent(value) || value.includes("BaoyanPilot 保研院校梯度规划报告")) {
      return value;
    }

    return value.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  }, [content]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mb-2 mt-1 text-xl font-bold leading-8 text-slate-950">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-3 text-lg font-bold leading-7 text-slate-950">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1.5 mt-2.5 text-base font-bold leading-7 text-slate-950">{children}</h3>,
        p: ({ children }) => <p className="my-1.5 leading-7 text-slate-700">{children}</p>,
        strong: ({ children }) => <strong className="font-bold text-slate-950">{children}</strong>,
        ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5 text-slate-700">{children}</ul>,
        ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5 text-slate-700">{children}</ol>,
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
          <code className="break-words rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.9em] font-semibold text-slate-800">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-3 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-800">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="my-3 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full table-fixed border-collapse bg-white text-left text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="break-words border-b border-slate-200 bg-blue-50 px-3 py-2 font-bold text-slate-900">{children}</th>,
        td: ({ children }) => <td className="break-words border-b border-slate-100 px-3 py-2 align-top text-slate-700">{children}</td>,
        hr: () => <hr className="my-4 border-slate-200" />,
      }}
    >
      {normalizedContent}
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
          "rounded-lg text-sm leading-7 shadow-sm",
          isAssistant
            ? "max-w-[88%] border border-slate-200 bg-white px-5 py-4 text-slate-700"
            : "max-w-[75%] bg-brand-600 px-5 py-3 text-white",
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

  const endpoint = import.meta.env.VITE_RECOMMEND_API_URL || "/api/recommend";
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 90000);
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: payloadMessages }),
      signal: controller.signal,
    });
  } catch (fetchError) {
    if (fetchError?.name === "AbortError") {
      throw new Error("AI 生成时间过长，请稍后重试，或先补充更聚焦的背景信息后再生成报告。");
    }

    throw new Error("AI 接口请求未能到达后端。若你在本地开发，请重启 npm run dev；若在 Vercel，请检查 /api/recommend 和 DEEPSEEK_API_KEY。");
  } finally {
    window.clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "AI 服务暂时不可用，请稍后重试。");
  }

  if (!data.reply) {
    throw new Error("AI 服务没有返回有效内容。");
  }

  return data.reply;
}

function ConversationSidebar({
  conversations,
  activeConversationId,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
}) {
  return (
    <aside className="hidden h-full w-[280px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft md:flex md:flex-col lg:w-[292px]">
      <div className="shrink-0 border-b border-slate-200 p-4">
        <button type="button" className="btn-primary w-full px-4 py-2.5" onClick={onCreateConversation}>
          <Plus size={17} aria-hidden="true" />
          新建对话
        </button>
      </div>

      <div className="shrink-0 px-4 pb-2 pt-4">
        <p className="text-sm font-bold text-slate-950">最近对话</p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeConversationId;

          return (
            <div
              key={conversation.id}
              className={[
                "group flex items-start gap-2 rounded-lg border p-3 transition",
                isActive
                  ? "border-blue-200 bg-blue-50 text-brand-700"
                  : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onSelectConversation(conversation.id)}
              >
                <span className="block truncate text-sm font-bold">{conversation.title}</span>
                <span className={`mt-1 block text-xs ${isActive ? "text-brand-600" : "text-slate-400"}`}>
                  {formatConversationTime(conversation.updatedAt)}
                </span>
              </button>
              <button
                type="button"
                className={[
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition",
                  isActive ? "text-brand-700 hover:bg-blue-100" : "text-slate-400 hover:bg-slate-200 hover:text-slate-700",
                ].join(" ")}
                onClick={() => onDeleteConversation(conversation.id)}
                aria-label={`删除对话：${conversation.title}`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default function AiRecommendChat() {
  const { user } = useAuth();
  const storageUser = useMemo(() => (user ? { id: user.id } : null), [user?.id]);
  const storageOwnerId = storageUser?.id || LOCAL_GUEST_USER_ID;
  const [initialConversationState] = useState(() => loadConversationState(null));
  const [conversations, setConversations] = useState(initialConversationState.conversations);
  const [activeConversationId, setActiveConversationId] = useState(initialConversationState.activeConversationId);
  const [loadedStorageOwnerId, setLoadedStorageOwnerId] = useState(LOCAL_GUEST_USER_ID);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const chatScrollRef = useRef(null);
  const chatEndRef = useRef(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0],
    [activeConversationId, conversations],
  );
  const messages = activeConversation?.messages || [];
  const storageNotice =
    user
      ? "已登录：当前记录已按账号保存在本地浏览器，暂不支持跨设备同步。"
      : "未登录：当前为本地模式，聊天记录仅保存在本浏览器。";
  const latestRecommendationReport = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "assistant" && isRecommendationReportContent(message.content)) || null,
    [messages],
  );

  useEffect(() => {
    const nextState = loadConversationState(storageUser);
    setConversations(nextState.conversations);
    setActiveConversationId(nextState.activeConversationId);
    setLoadedStorageOwnerId(storageOwnerId);
    setInput("");
    setError("");
  }, [storageOwnerId]);

  useEffect(() => {
    if (loadedStorageOwnerId !== storageOwnerId) {
      return;
    }

    saveConversationState(conversations, activeConversationId, storageUser);
  }, [activeConversationId, conversations, loadedStorageOwnerId, storageOwnerId, storageUser]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      return;
    }

    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversationId, isThinking, messages.length]);

  const handleCreateConversation = () => {
    const conversation = createConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setInput("");
    setError("");
  };

  const handleSelectConversation = (conversationId) => {
    setActiveConversationId(conversationId);
    setInput("");
    setError("");
  };

  const handleDeleteConversation = (conversationId) => {
    const remaining = conversations.filter((conversation) => conversation.id !== conversationId);

    if (!remaining.length) {
      const conversation = createConversation();
      setConversations([conversation]);
      setActiveConversationId(conversation.id);
    } else {
      setConversations(remaining);
      if (conversationId === activeConversationId) {
        setActiveConversationId(remaining[0].id);
      }
    }

    setInput("");
    setError("");
  };

  const handleClearMessages = () => {
    const now = new Date().toISOString();
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              title: DEFAULT_CONVERSATION_TITLE,
              messages: [createWelcomeMessage()],
              updatedAt: now,
            }
          : conversation,
      ),
    );
    setInput("");
    setError("");
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isThinking || !activeConversation) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      kind: "text",
      content,
    };
    const requestConversationId = activeConversation.id;
    const nextMessages = [...activeConversation.messages, userMessage];
    const now = new Date().toISOString();
    const hasUserMessage = activeConversation.messages.some((message) => message.role === "user");
    const nextTitle =
      !hasUserMessage && activeConversation.title === DEFAULT_CONVERSATION_TITLE
        ? createTitleFromMessage(content)
        : activeConversation.title;

    setConversations((current) =>
      current
        .map((conversation) =>
          conversation.id === requestConversationId
            ? {
                ...conversation,
                title: nextTitle,
                messages: nextMessages,
                updatedAt: now,
              }
            : conversation,
        )
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    );
    setInput("");
    setError("");
    setIsThinking(true);

    try {
      const reply = await requestAiRecommendation(nextMessages);
      const updatedAt = new Date().toISOString();
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        kind: "text",
        content: reply,
      };

      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === requestConversationId
              ? {
                  ...conversation,
                  messages: [...conversation.messages, assistantMessage],
                  updatedAt,
                }
              : conversation,
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      );
    } catch (requestError) {
      const errorMessage = requestError instanceof Error ? requestError.message : "AI 服务暂时不可用，请稍后重试。";
      const updatedAt = new Date().toISOString();
      const assistantMessage = {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        kind: "text",
        content: `接口调用失败：${errorMessage}`,
      };

      setError(errorMessage);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === requestConversationId
            ? {
                ...conversation,
                messages: [...conversation.messages, assistantMessage],
                updatedAt,
              }
            : conversation,
        ),
      );
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

  const handleDownloadPdf = () => {
    if (!latestRecommendationReport) {
      setError("当前对话还没有完整的院校推荐报告。请先补充背景信息，待 AI 输出冲、稳、保三档推荐后再下载。");
      return;
    }

    downloadRecommendationPdf({
      content: latestRecommendationReport.content,
      title: activeConversation?.title || "BaoyanPilot保研院校推荐报告",
    });
  };

  return (
    <div className="h-[calc(100vh-72px)] overflow-hidden bg-slate-50 py-3">
      <div className="container-page flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-700">AI 院校推荐助手</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-normal text-slate-950 sm:text-2xl">
              保研院校梯度对话
            </h1>
            <p className="mt-1 line-clamp-1 text-sm text-slate-600">
              补齐背景信息后，生成冲、稳、保三档院校规划报告。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-brand-700">
            <Sparkles size={17} aria-hidden="true" />
            DeepSeek API
          </div>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 gap-4 overflow-hidden">
          <ConversationSidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            onCreateConversation={handleCreateConversation}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
          />

          <div className="h-full min-w-0 flex-1">
            <Card className="flex h-full flex-col overflow-hidden">
              <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white">
                    <MessageSquareText size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-slate-950">{activeConversation?.title || "院校推荐对话"}</h2>
                    <p className="text-sm text-slate-500">服务端安全调用 AI API</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{storageNotice}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn-secondary px-3 py-2 md:hidden" onClick={handleCreateConversation}>
                    <Plus size={16} aria-hidden="true" />
                    新建
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleDownloadPdf}
                    disabled={!latestRecommendationReport}
                    title={
                      latestRecommendationReport
                        ? "下载最新院校推荐报告 PDF"
                        : "AI 输出完整冲、稳、保推荐报告后可下载 PDF"
                    }
                  >
                    <FileDown size={16} aria-hidden="true" />
                    下载PDF
                  </button>
                  <button type="button" className="btn-secondary px-3 py-2" onClick={handleClearMessages}>
                    <Trash2 size={16} aria-hidden="true" />
                    清空当前对话
                  </button>
                </div>
              </div>

              <div
                ref={chatScrollRef}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 px-5 py-4"
              >
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

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="block flex-1">
                    <span className="field-label">输入 background 或补充信息</span>
                    <textarea
                      className="field-control min-h-[72px] max-h-28 resize-y"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="例如：我是大二，会计专业，本科普通一本，GPA 3.8/4.0，排名前 10%，六级 570，有大创和商赛经历，想申请经管类，优先上海或江浙，风险偏好稳妥。"
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
          </div>
        </div>
      </div>
    </div>
  );
}
