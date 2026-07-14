import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Card, CardHeader } from "../components/Card.jsx";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";
import EditPostModal from "../components/forum/EditPostModal.jsx";
import ForumSearchBar from "../components/forum/ForumSearchBar.jsx";
import PostDetail from "../components/forum/PostDetail.jsx";
import PostList from "../components/forum/PostList.jsx";
import LoginModal from "../components/LoginModal.jsx";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { searchForumPosts, normalizeForumSearchQuery } from "../services/forumService.js";
import {
  deleteForumPost,
  deleteForumReply,
  fetchPostInteractionStats,
  fetchReplyInteractionStats,
  togglePostBookmark,
  togglePostDislike,
  togglePostLike,
  toggleReplyBookmark,
  toggleReplyDislike,
  toggleReplyLike,
  updateForumPost,
} from "../services/forumInteractionService.js";
import { createForumReply, fetchRepliesByPost } from "../services/forumReplyService.js";
import { getSafeCount } from "../components/forum/forumUtils.js";
import { collectReplyThreadIds } from "../utils/buildReplyTree.js";

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
const interactionSqlMessage =
  "互动数据加载失败，请确认已在 Supabase 执行 supabase/forum-interactions.sql 和 supabase/forum-dislikes.sql。";

const emptyPostForm = {
  title: "",
  category: "保研经验",
  content: "",
};

function normalizePost(row, replyCount = 0, stats = {}) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: postCategories.includes(row.category) ? row.category : "答疑求助",
    author_id: row.author_id,
    author_name: row.author_name || "匿名用户",
    author_avatar: row.author_avatar || "",
    login_type: row.login_type,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    replyCount,
    likeCount: getSafeCount(stats.likeCount),
    dislikeCount: getSafeCount(stats.dislikeCount),
    bookmarkCount: getSafeCount(stats.bookmarkCount),
    likedByCurrentUser: Boolean(stats.likedByCurrentUser),
    dislikedByCurrentUser: Boolean(stats.dislikedByCurrentUser),
    bookmarkedByCurrentUser: Boolean(stats.bookmarkedByCurrentUser),
  };
}

function normalizeReply(row, stats = {}) {
  return {
    id: row.id,
    post_id: row.post_id,
    content: row.content,
    author_id: row.author_id,
    author_name: row.author_name || "匿名用户",
    author_avatar: row.author_avatar || "",
    login_type: row.login_type,
    created_at: row.created_at,
    parent_reply_id: row.parent_reply_id || null,
    root_reply_id: row.root_reply_id || null,
    reply_to_author_id: row.reply_to_author_id || null,
    reply_to_author_name: row.reply_to_author_name || "",
    depth: Math.max(0, Number(row.depth) || 0),
    likeCount: getSafeCount(stats.likeCount),
    dislikeCount: getSafeCount(stats.dislikeCount),
    bookmarkCount: getSafeCount(stats.bookmarkCount),
    likedByCurrentUser: Boolean(stats.likedByCurrentUser),
    dislikedByCurrentUser: Boolean(stats.dislikedByCurrentUser),
    bookmarkedByCurrentUser: Boolean(stats.bookmarkedByCurrentUser),
  };
}

function logSupabaseError(label, error) {
  // eslint-disable-next-line no-console
  console.error(label, error);
  if (error?.code || error?.details || error?.hint) {
    // eslint-disable-next-line no-console
    console.error(`${label} meta:`, {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

function getAuthorPayload(user) {
  return {
    author_id: user.id,
    author_name: user.nickname || (user.phone ? `用户${String(user.phone).slice(-4)}` : "保研用户"),
    login_type: user.loginType || "phone_mock",
  };
}

function getLoginMessage(actionText) {
  return `请先使用手机号体验登录后再${actionText}。`;
}

export default function ForumPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearchQuery = normalizeForumSearchQuery(searchParams.get("q") || "");
  const initialCategory = categories.includes(searchParams.get("category")) ? searchParams.get("category") : "全部";
  const targetPostId = searchParams.get("post") || "";
  const targetReplyId = searchParams.get("reply") || "";
  const targetRootId = searchParams.get("root") || "";
  const [posts, setPosts] = useState([]);
  const [replies, setReplies] = useState([]);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchInput, setSearchInput] = useState(initialSearchQuery);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [searchError, setSearchError] = useState("");
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
  const [loginOpen, setLoginOpen] = useState(false);
  const [busyKeys, setBusyKeys] = useState(() => new Set());
  const [editingPost, setEditingPost] = useState(null);
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedThreadIds, setExpandedThreadIds] = useState(() => new Set());
  const [highlightReplyId, setHighlightReplyId] = useState("");

  const currentUserId = user?.loginType === "phone_mock" ? user.id : "";

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [posts],
  );

  const filteredPosts = sortedPosts;

  const selectedPost = posts.find((post) => post.id === selectedPostId) || filteredPosts[0] || null;
  const hasSearchQuery = Boolean(searchQuery);

  const setBusy = (key, value) => {
    setBusyKeys((current) => {
      const next = new Set(current);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const ensureDatabaseConfigured = () => {
    if (isSupabaseConfigured && supabase) {
      return true;
    }

    setErrorMessage(databaseNotConfiguredMessage);
    return false;
  };

  const requireInteractiveUser = (actionText) => {
    if (!user || user.loginType !== "phone_mock") {
      setErrorMessage(getLoginMessage(actionText));
      setLoginOpen(true);
      return null;
    }

    return user;
  };

  const handleSearchNow = () => {
    const nextQuery = normalizeForumSearchQuery(searchInput);
    setSearchInput(nextQuery);
    setSearchQuery((current) => (current === nextQuery ? current : nextQuery));
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setSearchError("");
  };

  const clearTargetParams = () => {
    const nextParams = new URLSearchParams();
    if (searchQuery) nextParams.set("q", searchQuery);
    if (activeCategory !== "全部") nextParams.set("category", activeCategory);
    setSearchParams(nextParams, { replace: true });
  };

  const fetchPosts = useCallback(
    async ({ selectPostId, query = searchQuery, category = activeCategory } = {}) => {
      if (!isSupabaseConfigured || !supabase) {
        setPosts([]);
        setSelectedPostId("");
        setErrorMessage(databaseNotConfiguredMessage);
        return;
      }

      setLoadingPosts(true);
      setErrorMessage("");
      setSearchError("");

      try {
        let postRows = await searchForumPosts({
          query,
          category,
          limit: 50,
          offset: 0,
        });

        if (selectPostId && !(postRows || []).some((post) => post.id === selectPostId)) {
          const { data: targetPost, error: targetPostError } = await supabase
            .from("forum_posts")
            .select("*")
            .eq("id", selectPostId)
            .maybeSingle();

          if (targetPostError) throw targetPostError;
          if (targetPost) {
            postRows = [targetPost, ...(postRows || [])];
          } else {
            setErrorMessage("原内容可能已经被删除或无法查看。");
          }
        }

        const postIds = (postRows || []).map((post) => post.id);
        const replyCounts = new Map();

        if (postIds.length) {
          const { data: replyRows, error: repliesError } = await supabase
            .from("forum_replies")
            .select("post_id")
            .in("post_id", postIds);

          if (repliesError) throw repliesError;

          (replyRows || []).forEach((reply) => {
            replyCounts.set(reply.post_id, (replyCounts.get(reply.post_id) || 0) + 1);
          });
        }

        let interactionStats = {};
        try {
          interactionStats = await fetchPostInteractionStats(postIds, currentUserId);
        } catch (error) {
          logSupabaseError("Fetch post interaction stats failed:", error);
          if (postIds.length) setErrorMessage(interactionSqlMessage);
        }

        const nextPosts = (postRows || []).map((post) =>
          normalizePost(post, replyCounts.get(post.id) || 0, interactionStats[post.id]),
        );
        setPosts(nextPosts);
        setSelectedPostId((currentId) => {
          if (selectPostId && nextPosts.some((post) => post.id === selectPostId)) return selectPostId;
          if (currentId && nextPosts.some((post) => post.id === currentId)) return currentId;
          return nextPosts[0]?.id || "";
        });
      } catch (error) {
        logSupabaseError("Failed to load forum posts:", error);
        const message = searchQuery
          ? "帖子搜索失败，请稍后重试，并确认已执行论坛搜索 SQL。"
          : "帖子加载失败，请稍后重试。";
        setSearchError(message);
        setErrorMessage(message);
      } finally {
        setLoadingPosts(false);
      }
    },
    [activeCategory, currentUserId, searchQuery],
  );

  const fetchReplies = useCallback(
    async (postId) => {
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
        const replyRows = await fetchRepliesByPost(postId);

        const replyIds = (replyRows || []).map((reply) => reply.id);
        let interactionStats = {};
        try {
          interactionStats = await fetchReplyInteractionStats(replyIds, currentUserId);
        } catch (statsError) {
          logSupabaseError("Fetch reply interaction stats failed:", statsError);
          if (replyIds.length) setErrorMessage(interactionSqlMessage);
        }

        setReplies((replyRows || []).map((reply) => normalizeReply(reply, interactionStats[reply.id])));
      } catch (error) {
        logSupabaseError("Failed to load forum replies:", error);
        setReplies([]);
        setErrorMessage(error?.message || "评论加载失败，请稍后重试。");
      } finally {
        setLoadingReplies(false);
      }
    },
    [currentUserId],
  );

  useEffect(() => {
    fetchPosts({ selectPostId: targetPostId || undefined });
  }, [fetchPosts, targetPostId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextQuery = normalizeForumSearchQuery(searchInput);
      setSearchQuery((current) => (current === nextQuery ? current : nextQuery));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (searchQuery) nextParams.set("q", searchQuery);
    if (activeCategory !== "全部") nextParams.set("category", activeCategory);
    if (targetPostId) nextParams.set("post", targetPostId);
    if (targetReplyId) nextParams.set("reply", targetReplyId);
    if (targetRootId) nextParams.set("root", targetRootId);
    setSearchParams(nextParams, { replace: true });
  }, [activeCategory, searchQuery, setSearchParams, targetPostId, targetReplyId, targetRootId]);

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
    setReplyingTo(null);
    setReplyContent("");
    setReplyError("");
    setExpandedThreadIds(new Set());
  }, [fetchReplies, selectedPostId]);

  useEffect(() => {
    if (!targetPostId || loadingPosts) return;
    if (posts.length && !posts.some((post) => post.id === targetPostId)) {
      setErrorMessage("原内容可能已经被删除或无法查看。");
      return;
    }
    if (targetPostId && posts.some((post) => post.id === targetPostId) && selectedPostId !== targetPostId) {
      setSelectedPostId(targetPostId);
    }
  }, [loadingPosts, posts, selectedPostId, targetPostId]);

  useEffect(() => {
    if (!targetReplyId || !selectedPostId || selectedPostId !== targetPostId || loadingReplies) return undefined;

    const targetReply = replies.find((reply) => reply.id === targetReplyId);
    if (!targetReply) {
      setErrorMessage("原内容可能已经被删除或无法查看。");
      return undefined;
    }

    const rootId = targetRootId || targetReply.root_reply_id || targetReply.id;
    if (rootId && rootId !== targetReply.id) {
      setExpandedThreadIds((current) => {
        const next = new Set(current);
        next.add(rootId);
        return next;
      });
    }

    const scrollTimer = window.setTimeout(() => {
      const element = document.getElementById(`forum-reply-${targetReplyId}`);
      if (!element) {
        setErrorMessage("原内容可能已经被删除或无法查看。");
        return;
      }
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightReplyId(targetReplyId);
    }, 120);

    const clearTimer = window.setTimeout(() => setHighlightReplyId(""), 2400);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [loadingReplies, replies, selectedPostId, targetPostId, targetReplyId, targetRootId]);

  const handleOpenPostForm = () => {
    const authUser = requireInteractiveUser("发布帖子");
    if (!authUser || !ensureDatabaseConfigured()) return;

    setShowPostForm(true);
    setPostError("");
    setErrorMessage("");
  };

  const handlePublishPost = async () => {
    const authUser = requireInteractiveUser("发布帖子");
    if (!authUser || !ensureDatabaseConfigured()) return;

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
      const payload = {
        title,
        content,
        category,
        ...getAuthorPayload(authUser),
      };
      const { data, error } = await supabase.from("forum_posts").insert([payload]).select("id").single();

      if (error) throw error;

      setPostForm(emptyPostForm);
      setShowPostForm(false);
      setActiveCategory("全部");
      setSearchInput("");
      setSearchQuery("");
      await fetchPosts({ selectPostId: data?.id, query: "", category: "全部" });
    } catch (error) {
      logSupabaseError("Create post failed:", error);
      const message = error?.message || "帖子发布失败，请稍后重试。";
      setPostError(message);
      setErrorMessage(message);
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async () => {
    const authUser = requireInteractiveUser("回复帖子");
    if (!authUser || !selectedPost || !ensureDatabaseConfigured()) return;

    const content = replyContent.trim();
    if (!content) {
      setReplyError("回复内容不能为空。");
      return;
    }

    setReplying(true);
    setReplyError("");
    setErrorMessage("");

    try {
      const createdReply = await createForumReply({
        postId: selectedPost.id,
        content,
        currentUser: authUser,
        parentReply: replyingTo?.parentReply || null,
      });

      setReplyContent("");
      setReplyingTo(null);
      const normalizedReply = normalizeReply(createdReply);
      setReplies((currentReplies) =>
        [...currentReplies, normalizedReply].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
      );
      if (replyingTo?.threadId) {
        setExpandedThreadIds((current) => {
          const next = new Set(current);
          next.add(replyingTo.threadId);
          return next;
        });
      }
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === selectedPost.id ? { ...post, replyCount: getSafeCount(post.replyCount) + 1 } : post,
        ),
      );
    } catch (error) {
      logSupabaseError("Create reply failed:", error);
      const message = error?.message || "回复失败，请稍后重试。";
      setReplyError(message);
      setErrorMessage(message);
    } finally {
      setReplying(false);
    }
  };

  const handleStartReplyToComment = (reply) => {
    const authUser = requireInteractiveUser("回复评论");
    if (!authUser) return;

    const threadId = reply.root_reply_id || reply.id;
    setReplyingTo({
      replyId: reply.id,
      threadId,
      authorId: reply.author_id,
      authorName: reply.author_name,
      parentReply: reply,
    });
    setReplyContent("");
    setReplyError("");
    setExpandedThreadIds((current) => {
      const next = new Set(current);
      next.add(threadId);
      return next;
    });
  };

  const handleCancelReplyToComment = () => {
    setReplyingTo(null);
    setReplyContent("");
    setReplyError("");
  };

  const handleToggleThreadExpanded = (threadId) => {
    setExpandedThreadIds((current) => {
      const next = new Set(current);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const applyPostInteraction = (postId, field, countField, active) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id !== postId) return post;
        const oldActive = Boolean(post[field]);
        const delta = active === oldActive ? 0 : active ? 1 : -1;
        return {
          ...post,
          [field]: active,
          [countField]: Math.max(0, getSafeCount(post[countField]) + delta),
        };
      }),
    );
  };

  const applyReplyInteraction = (replyId, field, countField, active) => {
    setReplies((currentReplies) =>
      currentReplies.map((reply) => {
        if (reply.id !== replyId) return reply;
        const oldActive = Boolean(reply[field]);
        const delta = active === oldActive ? 0 : active ? 1 : -1;
        return {
          ...reply,
          [field]: active,
          [countField]: Math.max(0, getSafeCount(reply[countField]) + delta),
        };
      }),
    );
  };

  const applyPostVoteState = (postId, nextVoteState) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id !== postId) return post;

        const nextLiked = Boolean(nextVoteState.liked);
        const nextDisliked = Boolean(nextVoteState.disliked);
        const likeDelta = nextLiked === Boolean(post.likedByCurrentUser) ? 0 : nextLiked ? 1 : -1;
        const dislikeDelta = nextDisliked === Boolean(post.dislikedByCurrentUser) ? 0 : nextDisliked ? 1 : -1;

        return {
          ...post,
          likedByCurrentUser: nextLiked,
          dislikedByCurrentUser: nextDisliked,
          likeCount: Math.max(0, getSafeCount(post.likeCount) + likeDelta),
          dislikeCount: Math.max(0, getSafeCount(post.dislikeCount) + dislikeDelta),
        };
      }),
    );
  };

  const applyReplyVoteState = (replyId, nextVoteState) => {
    setReplies((currentReplies) =>
      currentReplies.map((reply) => {
        if (reply.id !== replyId) return reply;

        const nextLiked = Boolean(nextVoteState.liked);
        const nextDisliked = Boolean(nextVoteState.disliked);
        const likeDelta = nextLiked === Boolean(reply.likedByCurrentUser) ? 0 : nextLiked ? 1 : -1;
        const dislikeDelta = nextDisliked === Boolean(reply.dislikedByCurrentUser) ? 0 : nextDisliked ? 1 : -1;

        return {
          ...reply,
          likedByCurrentUser: nextLiked,
          dislikedByCurrentUser: nextDisliked,
          likeCount: Math.max(0, getSafeCount(reply.likeCount) + likeDelta),
          dislikeCount: Math.max(0, getSafeCount(reply.dislikeCount) + dislikeDelta),
        };
      }),
    );
  };

  const handleTogglePostLike = async (postId) => {
    const authUser = requireInteractiveUser("点赞帖子");
    if (!authUser) return;

    const post = posts.find((item) => item.id === postId);
    if (!post) return;

    const key = `post-like:${postId}`;
    if (busyKeys.has(key) || busyKeys.has(`post-dislike:${postId}`)) return;

    const optimisticState = post.likedByCurrentUser
      ? { liked: false, disliked: false }
      : { liked: true, disliked: false };
    const oldState = {
      liked: post.likedByCurrentUser,
      disliked: post.dislikedByCurrentUser,
    };
    setBusy(key, true);
    applyPostVoteState(postId, optimisticState);
    setErrorMessage("");

    try {
      const result = await togglePostLike(postId, authUser.id);
      applyPostVoteState(postId, result);
    } catch (error) {
      applyPostVoteState(postId, oldState);
      setErrorMessage(error?.message || "点赞操作失败，请稍后重试。");
    } finally {
      setBusy(key, false);
    }
  };

  const handleTogglePostDislike = async (postId) => {
    const authUser = requireInteractiveUser("点踩帖子");
    if (!authUser) return;

    const post = posts.find((item) => item.id === postId);
    if (!post) return;

    const key = `post-dislike:${postId}`;
    if (busyKeys.has(key) || busyKeys.has(`post-like:${postId}`)) return;

    const optimisticState = post.dislikedByCurrentUser
      ? { liked: false, disliked: false }
      : { liked: false, disliked: true };
    const oldState = {
      liked: post.likedByCurrentUser,
      disliked: post.dislikedByCurrentUser,
    };
    setBusy(key, true);
    applyPostVoteState(postId, optimisticState);
    setErrorMessage("");

    try {
      const result = await togglePostDislike(postId, authUser.id);
      applyPostVoteState(postId, result);
    } catch (error) {
      applyPostVoteState(postId, oldState);
      setErrorMessage(error?.message || "点踩操作失败，请稍后重试。");
    } finally {
      setBusy(key, false);
    }
  };

  const handleTogglePostBookmark = async (postId) => {
    const authUser = requireInteractiveUser("收藏帖子");
    if (!authUser) return;

    const post = posts.find((item) => item.id === postId);
    if (!post) return;

    const key = `post-bookmark:${postId}`;
    if (busyKeys.has(key)) return;

    const nextActive = !post.bookmarkedByCurrentUser;
    setBusy(key, true);
    applyPostInteraction(postId, "bookmarkedByCurrentUser", "bookmarkCount", nextActive);
    setErrorMessage("");

    try {
      const result = await togglePostBookmark(postId, authUser.id);
      applyPostInteraction(postId, "bookmarkedByCurrentUser", "bookmarkCount", result.active);
    } catch (error) {
      applyPostInteraction(postId, "bookmarkedByCurrentUser", "bookmarkCount", post.bookmarkedByCurrentUser);
      setErrorMessage(error?.message || "收藏操作失败，请稍后重试。");
    } finally {
      setBusy(key, false);
    }
  };

  const handleToggleReplyLike = async (replyId) => {
    const authUser = requireInteractiveUser("点赞评论");
    if (!authUser) return;

    const reply = replies.find((item) => item.id === replyId);
    if (!reply) return;

    const key = `reply-like:${replyId}`;
    if (busyKeys.has(key) || busyKeys.has(`reply-dislike:${replyId}`)) return;

    const optimisticState = reply.likedByCurrentUser
      ? { liked: false, disliked: false }
      : { liked: true, disliked: false };
    const oldState = {
      liked: reply.likedByCurrentUser,
      disliked: reply.dislikedByCurrentUser,
    };
    setBusy(key, true);
    applyReplyVoteState(replyId, optimisticState);
    setErrorMessage("");

    try {
      const result = await toggleReplyLike(replyId, authUser.id);
      applyReplyVoteState(replyId, result);
    } catch (error) {
      applyReplyVoteState(replyId, oldState);
      setErrorMessage(error?.message || "评论点赞失败，请稍后重试。");
    } finally {
      setBusy(key, false);
    }
  };

  const handleToggleReplyDislike = async (replyId) => {
    const authUser = requireInteractiveUser("点踩评论");
    if (!authUser) return;

    const reply = replies.find((item) => item.id === replyId);
    if (!reply) return;

    const key = `reply-dislike:${replyId}`;
    if (busyKeys.has(key) || busyKeys.has(`reply-like:${replyId}`)) return;

    const optimisticState = reply.dislikedByCurrentUser
      ? { liked: false, disliked: false }
      : { liked: false, disliked: true };
    const oldState = {
      liked: reply.likedByCurrentUser,
      disliked: reply.dislikedByCurrentUser,
    };
    setBusy(key, true);
    applyReplyVoteState(replyId, optimisticState);
    setErrorMessage("");

    try {
      const result = await toggleReplyDislike(replyId, authUser.id);
      applyReplyVoteState(replyId, result);
    } catch (error) {
      applyReplyVoteState(replyId, oldState);
      setErrorMessage(error?.message || "评论点踩失败，请稍后重试。");
    } finally {
      setBusy(key, false);
    }
  };

  const handleToggleReplyBookmark = async (replyId) => {
    const authUser = requireInteractiveUser("收藏评论");
    if (!authUser) return;

    const reply = replies.find((item) => item.id === replyId);
    if (!reply) return;

    const key = `reply-bookmark:${replyId}`;
    if (busyKeys.has(key)) return;

    const nextActive = !reply.bookmarkedByCurrentUser;
    setBusy(key, true);
    applyReplyInteraction(replyId, "bookmarkedByCurrentUser", "bookmarkCount", nextActive);
    setErrorMessage("");

    try {
      const result = await toggleReplyBookmark(replyId, authUser.id);
      applyReplyInteraction(replyId, "bookmarkedByCurrentUser", "bookmarkCount", result.active);
    } catch (error) {
      applyReplyInteraction(replyId, "bookmarkedByCurrentUser", "bookmarkCount", reply.bookmarkedByCurrentUser);
      setErrorMessage(error?.message || "评论收藏失败，请稍后重试。");
    } finally {
      setBusy(key, false);
    }
  };

  const handleEditPost = (post) => {
    if (!requireInteractiveUser("编辑帖子")) return;
    if (user.id !== post.author_id) {
      setErrorMessage("只能编辑自己发布的帖子。");
      return;
    }
    setEditingPost(post);
    setEditError("");
  };

  const handleSubmitEdit = async (values) => {
    const authUser = requireInteractiveUser("编辑帖子");
    if (!authUser || !editingPost) return;

    setSavingEdit(true);
    setEditError("");
    setErrorMessage("");

    try {
      const row = await updateForumPost(editingPost.id, authUser.id, values);
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === editingPost.id
            ? normalizePost(row, post.replyCount, {
                likeCount: post.likeCount,
                dislikeCount: post.dislikeCount,
                bookmarkCount: post.bookmarkCount,
                likedByCurrentUser: post.likedByCurrentUser,
                dislikedByCurrentUser: post.dislikedByCurrentUser,
                bookmarkedByCurrentUser: post.bookmarkedByCurrentUser,
              })
            : post,
        ),
      );
      setEditingPost(null);
    } catch (error) {
      logSupabaseError("Update post failed:", error);
      setEditError(error?.message || "帖子更新失败，请稍后重试。");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePostRequest = (post) => {
    if (!requireInteractiveUser("删除帖子")) return;
    if (user.id !== post.author_id) {
      setErrorMessage("只能删除自己发布的帖子。");
      return;
    }
    setConfirmState({ type: "post", post });
  };

  const handleDeleteReplyRequest = (reply) => {
    if (!requireInteractiveUser("删除评论")) return;
    if (user.id !== reply.author_id && user.id !== selectedPost?.author_id) {
      setErrorMessage("你只能删除自己的评论，或删除自己帖子下的评论。");
      return;
    }
    const deleteIds = collectReplyThreadIds(replies, reply.id);
    setConfirmState({ type: "reply", reply, deleteCount: deleteIds.length });
  };

  const handleConfirmDelete = async () => {
    const authUser = requireInteractiveUser("删除内容");
    if (!authUser || !confirmState) return;

    setDeleting(true);
    setErrorMessage("");

    try {
      if (confirmState.type === "post") {
        await deleteForumPost({
          postId: confirmState.post.id,
          postAuthorId: confirmState.post.author_id,
          currentUserId: authUser.id,
        });
        const deletedId = confirmState.post.id;
        setPosts((currentPosts) => {
          const nextPosts = currentPosts.filter((post) => post.id !== deletedId);
          setSelectedPostId((currentId) => (currentId === deletedId ? nextPosts[0]?.id || "" : currentId));
          return nextPosts;
        });
        setReplies([]);
      } else if (confirmState.type === "reply") {
        const deleteIds = collectReplyThreadIds(replies, confirmState.reply.id);
        await deleteForumReply({
          replyId: confirmState.reply.id,
          replyAuthorId: confirmState.reply.author_id,
          postAuthorId: selectedPost?.author_id,
          currentUserId: authUser.id,
        });
        setReplies((currentReplies) => currentReplies.filter((reply) => !deleteIds.includes(reply.id)));
        setExpandedThreadIds((current) => {
          const next = new Set(current);
          deleteIds.forEach((id) => next.delete(id));
          return next;
        });
        if (selectedPost) {
          setPosts((currentPosts) =>
            currentPosts.map((post) =>
              post.id === selectedPost.id
                ? { ...post, replyCount: Math.max(0, getSafeCount(post.replyCount) - deleteIds.length) }
                : post,
            ),
          );
        }
      }
      setConfirmState(null);
    } catch (error) {
      logSupabaseError("Delete forum content failed:", error);
      setErrorMessage(error?.message || "删除失败，请稍后重试。");
    } finally {
      setDeleting(false);
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

        <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-brand-700">
          当前为模拟登录体验版。浏览公开开放，发布、回复、点赞、点踩、收藏、编辑和删除需要使用手机号体验登录。
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-6">
          <ForumSearchBar
            value={searchInput}
            loading={loadingPosts}
            onChange={setSearchInput}
            onSearch={handleSearchNow}
            onClear={handleClearSearch}
          />
          {searchError && <p className="mt-2 text-sm font-semibold text-red-600">{searchError}</p>}
          {hasSearchQuery && !searchError && (
            <p className="mt-2 text-sm text-slate-500">
              找到 {filteredPosts.length} 篇与“{searchQuery}”相关的帖子
            </p>
          )}
        </div>

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
          <PostList
            posts={filteredPosts}
            selectedPostId={selectedPost?.id || ""}
            currentUserId={currentUserId}
            loading={loadingPosts}
            searchQuery={searchQuery}
            busyKeys={busyKeys}
            onSelectPost={(postId) => {
              setSelectedPostId(postId);
              setReplyError("");
              if (targetPostId || targetReplyId || targetRootId) clearTargetParams();
            }}
            onTogglePostLike={handleTogglePostLike}
            onTogglePostDislike={handleTogglePostDislike}
            onTogglePostBookmark={handleTogglePostBookmark}
            onEditPost={handleEditPost}
            onDeletePost={handleDeletePostRequest}
          />

          <PostDetail
            post={selectedPost}
            replies={replies}
            currentUserId={currentUserId}
            loadingReplies={loadingReplies}
            replying={replying}
            replyingTo={replyingTo}
            expandedThreadIds={expandedThreadIds}
            highlightReplyId={highlightReplyId}
            replyContent={replyContent}
            replyError={replyError}
            busyKeys={busyKeys}
            onReplyContentChange={(value) => {
              setReplyContent(value);
              setReplyError("");
            }}
            onReply={handleReply}
            onStartReplyToComment={handleStartReplyToComment}
            onCancelReplyToComment={handleCancelReplyToComment}
            onToggleThreadExpanded={handleToggleThreadExpanded}
            onTogglePostLike={handleTogglePostLike}
            onTogglePostDislike={handleTogglePostDislike}
            onTogglePostBookmark={handleTogglePostBookmark}
            onToggleReplyLike={handleToggleReplyLike}
            onToggleReplyDislike={handleToggleReplyDislike}
            onToggleReplyBookmark={handleToggleReplyBookmark}
            onEditPost={handleEditPost}
            onDeletePost={handleDeletePostRequest}
            onDeleteReply={handleDeleteReplyRequest}
          />
        </div>

        <p className="mt-8 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-500">
          当前论坛数据使用 Supabase 数据库存储。当前权限控制仍属于产品原型体验版，后续会接入 Supabase Auth 和更严格的 RLS。
        </p>
      </div>

      <EditPostModal
        open={Boolean(editingPost)}
        post={editingPost}
        categories={postCategories}
        saving={savingEdit}
        errorMessage={editError}
        onClose={() => {
          if (!savingEdit) setEditingPost(null);
        }}
        onSubmit={handleSubmitEdit}
      />

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.type === "post" ? "删除帖子" : "删除评论"}
        description={
          confirmState?.type === "post"
            ? "删除帖子后，帖子下的全部评论、点赞、点踩和收藏也会被删除，且无法恢复。"
            : confirmState?.deleteCount > 1
              ? "删除该评论后，其下全部回复也会被删除，且无法恢复。"
              : "确定删除这条评论吗？删除后无法恢复。"
        }
        confirmText="确认删除"
        loading={deleting}
        onCancel={() => {
          if (!deleting) setConfirmState(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
