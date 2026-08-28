import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Camera, MessageSquareText, UserRound } from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import StudentVerificationCard from "../components/profile/StudentVerificationCard.jsx";
import { fetchMyPosts, fetchMyReplies, uploadAvatar } from "../services/profileService.js";
import { fetchMySchoolBinding } from "../services/mySchoolBindingService.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getScopedStorageKey } from "../utils/auth.js";
import { fetchSchools } from "../utils/schoolData.js";

const conversationBaseKey = "baoyanpilot_ai_conversations";

function getInitials(name) {
  const value = String(name || "保研用户").trim();
  return value.slice(0, 1).toUpperCase();
}

function validateAvatarFile(file) {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return "头像仅支持 jpg、jpeg、png、webp 格式。";
  }

  if (file.size > 2 * 1024 * 1024) {
    return "头像文件不能超过 2MB。";
  }

  return "";
}

function getDefaultProfile(user) {
  return {
    nickname: user?.nickname || "保研用户",
    avatar_url: user?.avatar || user?.avatarUrl || "",
    bio: user?.bio || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function getAiConversationCount(user) {
  if (typeof window === "undefined" || !user) {
    return 0;
  }

  try {
    const value = window.localStorage.getItem(getScopedStorageKey(conversationBaseKey, user));
    return value ? JSON.parse(value).length || 0 : 0;
  } catch {
    return 0;
  }
}

export default function ProfilePage() {
  const { user, profile, isAuthenticated, updateUserProfile } = useAuth();
  const [form, setForm] = useState(() => getDefaultProfile(null));
  const [contentStats, setContentStats] = useState({
    posts: 0,
    replies: 0,
    aiConversations: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [mySchoolBinding, setMySchoolBinding] = useState(null);
  const [schools, setSchools] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState("");
  const [latestVerification, setLatestVerification] = useState(null);

  const avatarPreview = form.avatar_url;
  const displayNickname = form.nickname || "保研用户";
  const bioCount = useMemo(() => form.bio.length, [form.bio]);
  const verifiedAcademicInfo = latestVerification?.status === "verified" ? latestVerification : null;

  useEffect(() => {
    const controller = new AbortController();

    async function loadSchools() {
      setSchoolsLoading(true);
      setSchoolsError("");
      try {
        setSchools(await fetchSchools({ signal: controller.signal }));
      } catch (error) {
        if (error.name !== "AbortError") {
          setSchools([]);
          setSchoolsError("院校数据加载失败，请稍后刷新页面。");
        }
      } finally {
        if (!controller.signal.aborted) setSchoolsLoading(false);
      }
    }

    loadSchools();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setForm(getDefaultProfile(null));
      setContentStats({ posts: 0, replies: 0, aiConversations: 0 });
      setMySchoolBinding(null);
      setLatestVerification(null);
      return;
    }

    setForm({ ...getDefaultProfile(user), ...(profile || {}) });
    setLatestVerification(null);
    setMessage("");
    setErrorMessage("");

    async function loadAccountData() {
      setLoadingStats(true);
      try {
        const [myPosts, myReplies, binding] = await Promise.all([
          fetchMyPosts(user.id),
          fetchMyReplies(user.id),
          fetchMySchoolBinding(user.id),
        ]);
        setMySchoolBinding(binding);
        setContentStats({
          posts: myPosts.length,
          replies: myReplies.length,
          aiConversations: getAiConversationCount(user),
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Load profile content stats failed:", error);
        setContentStats({
          posts: 0,
          replies: 0,
          aiConversations: getAiConversationCount(user),
        });
      } finally {
        setLoadingStats(false);
      }
    }

    loadAccountData();
  }, [isAuthenticated, profile, user?.id]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
    setErrorMessage("");
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !isAuthenticated || !user) {
      return;
    }

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setUploadingAvatar(true);
    setMessage("");
    setErrorMessage("");

    try {
      const avatarUrl = await uploadAvatar(user.id, file);
      setForm((current) => ({ ...current, avatar_url: avatarUrl }));
    } catch (error) {
      setErrorMessage(error?.message || "头像上传失败，请稍后重试。");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!isAuthenticated || !user) {
      setErrorMessage("请先登录后再编辑个人资料。");
      return;
    }

    const nickname = form.nickname.trim();
    const bio = form.bio.trim();

    if (!nickname) {
      setErrorMessage("昵称不能为空。");
      return;
    }

    if (nickname.length < 2 || nickname.length > 20) {
      setErrorMessage("昵称需要为 2 到 20 个字符。");
      return;
    }

    if (bio.length > 200) {
      setErrorMessage("个人简介不能超过 200 字。");
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const nextProfile = await updateUserProfile({ nickname, avatar_url: form.avatar_url, bio });
      setForm(nextProfile);
      setMessage("个人资料已保存到云端。");
    } catch (error) {
      setErrorMessage(error?.message || "保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="bg-slate-50 py-10">
        <div className="container-page">
          <Card className="p-8 text-center">
            <UserRound className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-slate-950">个人中心</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">请先登录真实账号后再管理个人资料；游客模式仅支持浏览公开内容。</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <CardHeader eyebrow="账号资料" title="个人中心" description="管理你的个人资料、院校信息和学籍核验状态。" />

        <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-brand-700">
          个人资料和我的院校已与当前 Supabase 账号同步；学籍核验材料仍由管理员人工完成最终审核。
        </div>

        {message && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">个人资料</h2>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">
                云端账号
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex shrink-0 flex-col items-center gap-3">
                <div className="relative h-24 w-24 overflow-hidden rounded-full bg-blue-50 text-brand-700">
                  {avatarPreview ? (
                    <img className="h-full w-full object-cover" src={avatarPreview} alt="用户头像" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold">
                      {getInitials(displayNickname)}
                    </div>
                  )}
                </div>
                <label className="btn-secondary cursor-pointer px-3 py-2">
                  <Camera size={16} aria-hidden="true" />
                  {uploadingAvatar ? "上传中..." : "上传头像"}
                  <input className="hidden" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleAvatarChange} />
                </label>
              </div>

              <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="field-label">昵称</span>
                  <input
                    className="field-control"
                    value={form.nickname}
                    onChange={(event) => updateForm("nickname", event.target.value)}
                    placeholder="请输入昵称"
                  />
                </label>
                <label className="block">
                  <span className="field-label">所在院校</span>
                  <input
                    className="field-control cursor-not-allowed bg-slate-50 text-slate-700"
                    value={verifiedAcademicInfo?.school_name || ""}
                    placeholder="学籍核验通过后自动填写"
                    readOnly
                  />
                  <span className="mt-1 block text-xs text-slate-400">该信息来自已通过的学籍核验，不能手动修改。</span>
                </label>
                <label className="block">
                  <span className="field-label">专业</span>
                  <input
                    className="field-control cursor-not-allowed bg-slate-50 text-slate-700"
                    value={verifiedAcademicInfo?.major_name || ""}
                    placeholder="学籍核验通过后自动填写"
                    readOnly
                  />
                  <span className="mt-1 block text-xs text-slate-400">该信息来自已通过的学籍核验，不能手动修改。</span>
                </label>
                <label className="block md:col-span-2">
                  <span className="field-label">个人简介</span>
                  <textarea
                    className="field-control min-h-[112px] resize-y"
                    value={form.bio}
                    onChange={(event) => updateForm("bio", event.target.value)}
                    placeholder="简单介绍一下自己吧~"
                  />
                  <span className="mt-1 block text-right text-xs text-slate-400">{bioCount}/200</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="btn-primary disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={handleSaveProfile}
                disabled={saving || uploadingAvatar}
              >
                {saving ? "保存中..." : "保存修改"}
              </button>
            </div>
          </Card>

          <div className="space-y-6">
            <StudentVerificationCard
              user={user}
              userName={displayNickname}
              binding={mySchoolBinding}
              schools={schools}
              schoolsLoading={schoolsLoading}
              schoolsError={schoolsError}
              onVerificationChange={setLatestVerification}
            />

            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">我的内容</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">查看当前账号在云端保存的内容记录。</p>
                </div>
                <MessageSquareText className="h-8 w-8 text-brand-600" aria-hidden="true" />
              </div>

              <Link
                to="/my-school"
                className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm transition hover:border-brand-300"
              >
                <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-brand-700">
                  <Building2 size={17} aria-hidden="true" />
                  <span className="truncate">我的院校：{mySchoolBinding?.schoolName || "暂未绑定"}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-brand-700">进入</span>
              </Link>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-2xl font-bold text-slate-950">{loadingStats ? "-" : contentStats.posts}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">我的帖子</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-2xl font-bold text-slate-950">{loadingStats ? "-" : contentStats.replies}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">我的回复</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-2xl font-bold text-slate-950">{contentStats.aiConversations}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">AI 对话</p>
                </div>
              </div>

              <Link to="/forum" className="btn-secondary mt-5 w-full justify-center">
                <MessageSquareText size={16} aria-hidden="true" />
                查看我的帖子
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
