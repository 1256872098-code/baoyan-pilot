import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  MessageCircle,
  MessageSquarePlus,
  MessagesSquare,
  Send,
  UserRound,
} from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { AUTH_CHANGED_EVENT, getCurrentUser } from "../utils/auth.js";

const categories = [
  "全部",
  "保研经验",
  "院校信息",
  "材料准备",
  "夏令营",
  "预推免",
  "九推",
  "面试经验",
  "竞赛科研",
  "答疑求助",
];

const postCategories = categories.filter((category) => category !== "全部");
const databaseNotConfiguredMessage = "论坛数据库暂未配置，请配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。";

function normalizePost(row, replyCount = 0) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: postCategories.includes(row.category) ? row.category : "答疑求助",
    authorId: row.author_id,
    authorName: row.author_name || "匿名用户",
    loginType: row.login_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    replyCount,
  };
}

function normalizeReply(row) {
  return {
    id: row.id,
    postId: row.post_id,
    content: row.content,
    authorId: row.author_id,
    authorName: row.author_name || "匿名用户",
    loginType: row.login_type,
    createdAt: row.created_at,
  };
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getExcerpt(content) {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 92 ? `${compact.slice(0, 92)}...` : compact;
}

const emptyPostForm = {
  title: "",
  category: "保研经验",
  content: "",
};

export default function ForumPage() {
  const [posts, setPosts] = useState([]);
  const [replies, setReplies] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [activeCategory, setActiveCategory] = useState("全部");
  const [selectedPostId, setSelectedPostId] = useState("");
  const [showPostForm, setShowPostForm] = useState(false);
  const [postForm, setPostForm] = useState(emptyPostForm);
  const [postError, setPostError] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [replyError, setReplyError] = useState("");
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [posting, setPosting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [posts],
  );

  const filteredPosts = useMemo(
    () =>
      activeCategory === "全部"
        ? sortedPosts
        : sortedPosts.filter((post) => post.category === activeCategory),
    [activeCategory, sortedPosts],
  );

  const selectedPost = posts.find((post) => post.id === selectedPostId) || filteredPosts[0] || null;
  const isGuest = currentUser?.loginType === "guest";

  const fetchPosts = useCallback(async ({ selectPostId } = {}) => {
    if (!isSupabaseConfigured || !supabase) {
      setPosts([]);
      setSelectedPostId("");
      setErrorMessage(databaseNotConfiguredMessage);
      return;
    }

    setLoadingPosts(true);
    setErrorMessage("");

    try {
      const { data: postRows, error: postsError } = await supabase
        .from("forum_posts")
        .select("id,title,content,category,author_id,author_name,login_type,created_at,updated_at")
        .order("created_at", { ascending: false });

      if (postsError) {
        throw postsError;
      }

      const postIds = (postRows || []).map((post) => post.id);
      const replyCounts = new Map();

      if (postIds.length) {
        const { data: replyRows, error: repliesError } = await supabase
          .from("forum_replies")
          .select("post_id")
          .in("post_id", postIds);

        if (repliesError) {
          throw repliesError;
        }

        (replyRows || []).forEach((reply) => {
          replyCounts.set(reply.post_id, (replyCounts.get(reply.post_id) || 0) + 1);
        });
      }

      const nextPosts = (postRows || []).map((post) => normalizePost(post, replyCounts.get(post.id) || 0));
      setPosts(nextPosts);
      setSelectedPostId((currentId) => {
        if (selectPostId && nextPosts.some((post) => post.id === selectPostId)) {
          return selectPostId;
        }

        if (currentId && nextPosts.some((post) => post.id === currentId)) {
          return currentId;
        }

        return nextPosts[0]?.id || "";
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load forum posts", error);
      setErrorMessage("帖子加载失败，请稍后重试。");
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const fetchReplies = useCallback(async (postId) => {
    if (!postId) {
      setReplies([]);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setReplies([]);
      setErrorMessage(databaseNotConfiguredMessage);
      return;
    }

    setLoadingReplies(true);
    setReplyError("");

    try {
      const { data: replyRows, error } = await supabase
        .from("forum_replies")
        .select("id,post_id,content,author_id,author_name,login_type,created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      setReplies((replyRows || []).map(normalizeReply));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load forum replies", error);
      setReplies([]);
      setErrorMessage("评论加载失败，请稍后重试。");
    } finally {
      setLoadingReplies(false);
    }
  }, []);

  useEffect(() => {
    const syncUser = () => setCurrentUser(getCurrentUser());
    window.addEventListener(AUTH_CHANGED_EVENT, syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!filteredPosts.length) {
      setSelectedPostId("");
      return;
    }

    if (!filteredPosts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(filteredPosts[0].id);
    }
  }, [filteredPosts, selectedPostId]);

  useEffect(() => {
    fetchReplies(selectedPostId);
  }, [fetchReplies, selectedPostId]);

  const requireUser = () => {
    const user = getCurrentUser();
    setCurrentUser(user);
    if (!user) {
      window.alert("请先登录后再操作");
      return null;
    }

    return user;
  };

  const ensureDatabaseConfigured = () => {
    if (isSupabaseConfigured && supabase) {
      return true;
    }

    setErrorMessage(databaseNotConfiguredMessage);
    return false;
  };

  const handleOpenPostForm = () => {
    const user = requireUser();
    if (!user || !ensureDatabaseConfigured()) return;

    setShowPostForm(true);
    setPostError("");
  };

  const handlePublishPost = async () => {
    const user = requireUser();
    if (!user || !ensureDatabaseConfigured()) return;

    const title = postForm.title.trim();
    const content = postForm.content.trim();
    const category = postForm.category;

    if (!title) {
      setPostError("标题不能为空。");
      return;
    }

    if (!category) {
      setPostError("分类不能为空。");
      return;
    }

    if (!content) {
      setPostError("正文不能为空。");
      return;
    }

    setPosting(true);
    setPostError("");
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("forum_posts")
        .insert([
          {
            title,
            content,
            category,
            author_id: user.id,
            author_name: user.nickname,
            login_type: user.loginType,
          },
        ])
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      setPostForm(emptyPostForm);
      setShowPostForm(false);
      setActiveCategory("全部");
      await fetchPosts({ selectPostId: data?.id });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create forum post", error);
      setPostError("帖子发布失败，请稍后重试。");
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async () => {
    const user = requireUser();
    if (!user || !selectedPost || !ensureDatabaseConfigured()) return;

    const content = replyContent.trim();
    if (!content) {
      setReplyError("回复内容不能为空。");
      return;
    }

    setReplying(true);
    setReplyError("");
    setErrorMessage("");

    try {
      const { error } = await supabase.from("forum_replies").insert([
        {
          post_id: selectedPost.id,
          content,
          author_id: user.id,
          author_name: user.nickname,
          login_type: user.loginType,
        },
      ]);

      if (error) {
        throw error;
      }

      setReplyContent("");
      await fetchReplies(selectedPost.id);
      await fetchPosts({ selectPostId: selectedPost.id });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create forum reply", error);
      setReplyError("回复失败，请稍后重试。");
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <CardHeader
            eyebrow="社区交流"
            title="保研论坛"
            description="分享保研经验、院校信息、材料准备、夏令营、预推免和面试经验。"
          />
          <button type="button" className="btn-primary shrink-0" onClick={handleOpenPostForm}>
            <MessageSquarePlus size={18} aria-hidden="true" />
            发布帖子
          </button>
        </div>

        {isGuest && (
          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-brand-700">
            游客模式下昵称和数据为临时身份，后续正式版将接入真实账号系统。
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          {categories.map((category) => {
            const isActive = category === activeCategory;
            return (
              <button
                key={category}
                type="button"
                className={[
                  "rounded-md border px-3 py-2 text-sm font-semibold transition",
                  isActive
                    ? "border-blue-200 bg-blue-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700",
                ].join(" ")}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            );
          })}
        </div>

        {showPostForm && (
          <Card className="mt-6 p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-950">发布帖子</h2>
              <button
                type="button"
                className="btn-secondary px-3 py-2"
                onClick={() => {
                  setShowPostForm(false);
                  setPostError("");
                }}
                disabled={posting}
              >
                取消
              </button>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
              <label className="block">
                <span className="field-label">标题</span>
                <input
                  className="field-control"
                  value={postForm.title}
                  onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="请输入帖子标题"
                />
              </label>
              <label className="block">
                <span className="field-label">分类</span>
                <select
                  className="field-control"
                  value={postForm.category}
                  onChange={(event) => setPostForm((current) => ({ ...current, category: event.target.value }))}
                >
                  {postCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 block">
              <span className="field-label">正文</span>
              <textarea
                className="field-control min-h-[120px] resize-y"
                value={postForm.content}
                onChange={(event) => setPostForm((current) => ({ ...current, content: event.target.value }))}
                placeholder="请写下你的经验、问题或资料信息"
              />
            </label>
            {postError && <p className="mt-3 text-sm font-semibold text-red-600">{postError}</p>}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="btn-primary disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={handlePublishPost}
                disabled={posting}
              >
                {posting ? "发布中..." : "发布"}
              </button>
            </div>
          </Card>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="space-y-3">
            {loadingPosts ? (
              <Card className="p-6 text-center text-sm font-semibold text-slate-500">正在加载帖子...</Card>
            ) : filteredPosts.length ? (
              filteredPosts.map((post) => {
                const isSelected = selectedPost?.id === post.id;
                return (
                  <button
                    key={post.id}
                    type="button"
                    className={[
                      "block w-full rounded-lg border bg-white p-4 text-left shadow-sm transition",
                      isSelected
                        ? "border-blue-200 ring-2 ring-blue-100"
                        : "border-slate-200 hover:border-brand-300 hover:bg-blue-50/40",
                    ].join(" ")}
                    onClick={() => {
                      setSelectedPostId(post.id);
                      setReplyError("");
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="line-clamp-2 font-bold leading-6 text-slate-950">{post.title}</h2>
                      <span className="badge shrink-0">{post.category}</span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{getExcerpt(post.content)}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                      <span>{post.authorName}</span>
                      <span>{formatTime(post.createdAt)}</span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle size={14} aria-hidden="true" />
                        {post.replyCount} 回复
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <Card className="p-6 text-center text-sm text-slate-500">当前分类暂无帖子。</Card>
            )}
          </div>

          <Card className="p-5">
            {selectedPost ? (
              <div>
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className="badge">{selectedPost.category}</span>
                    <h2 className="mt-3 text-2xl font-bold leading-8 text-slate-950">{selectedPost.title}</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound size={15} aria-hidden="true" />
                        {selectedPost.authorName}
                      </span>
                      <span>{formatTime(selectedPost.createdAt)}</span>
                      <span>{selectedPost.replyCount} 条回复</span>
                    </div>
                  </div>
                </div>

                <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedPost.content}</p>

                <div className="mt-6 border-t border-slate-200 pt-5">
                  <h3 className="flex items-center gap-2 font-bold text-slate-950">
                    <MessagesSquare size={18} aria-hidden="true" />
                    回复列表
                  </h3>
                  <div className="mt-4 space-y-3">
                    {loadingReplies ? (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        正在加载评论...
                      </p>
                    ) : replies.length ? (
                      replies.map((reply) => (
                        <div key={reply.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                            <span>{reply.authorName}</span>
                            <span>{formatTime(reply.createdAt)}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{reply.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        暂无回复，可以发表第一条讨论。
                      </p>
                    )}
                  </div>

                  <div className="mt-5">
                    <label className="block">
                      <span className="field-label">回复内容</span>
                      <textarea
                        className="field-control min-h-[96px] resize-y"
                        value={replyContent}
                        onChange={(event) => {
                          setReplyContent(event.target.value);
                          setReplyError("");
                        }}
                        placeholder="写下你的建议、经验或补充信息"
                      />
                    </label>
                    {replyError && <p className="mt-3 text-sm font-semibold text-red-600">{replyError}</p>}
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        className="btn-primary disabled:cursor-not-allowed disabled:bg-slate-300"
                        onClick={handleReply}
                        disabled={replying}
                      >
                        <Send size={17} aria-hidden="true" />
                        {replying ? "回复中..." : "回复"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center">
                <MessagesSquare className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm text-slate-500">请选择一个帖子查看详情。</p>
              </div>
            )}
          </Card>
        </div>

        <p className="mt-8 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-500">
          当前论坛已接入 Supabase 数据库存储。账号体系仍为产品原型阶段，后续可接入正式认证和更完整的社区治理能力。
        </p>
      </div>
    </div>
  );
}
