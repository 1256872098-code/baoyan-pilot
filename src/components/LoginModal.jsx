import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogIn, UserPlus, UserRound, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginModal({ open, onClose }) {
  const modalRef = useRef(null);
  const { signInWithPassword, signUp, loginAsGuest } = useAuth();
  const [mode, setMode] = useState("login");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    modalRef.current?.scrollTo({ top: 0 });
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (open) return;
    setMode("login");
    setNickname("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setSubmitting(false);
    setError("");
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const validate = () => {
    const normalizedEmail = email.trim();
    if (mode === "register" && (nickname.trim().length < 2 || nickname.trim().length > 20)) {
      throw new Error("昵称需要为 2 到 20 个字符。");
    }
    if (!emailPattern.test(normalizedEmail)) throw new Error("请输入有效的邮箱地址。");
    if (password.length < 8) throw new Error("密码至少需要 8 位。");
    if (mode === "register" && password !== confirmPassword) throw new Error("两次输入的密码不一致。");
    return normalizedEmail;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const normalizedEmail = validate();
      if (mode === "login") await signInWithPassword({ email: normalizedEmail, password });
      else await signUp({ nickname: nickname.trim(), email: normalizedEmail, password });
      onClose();
    } catch (submitError) {
      setError(submitError?.message || `${mode === "login" ? "登录" : "注册"}失败，请稍后重试。`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestLogin = async () => {
    setSubmitting(true);
    setError("");
    try {
      await loginAsGuest();
      onClose();
    } catch (guestError) {
      setError(guestError?.message || "进入游客体验失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/45">
      <div className="flex min-h-dvh items-center justify-center px-4 py-6">
        <div ref={modalRef} className="max-h-[calc(100dvh-48px)] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">{mode === "login" ? "登录" : "注册账号"}</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">登录后可跨设备同步个人资料、我的院校与互动记录。</p>
            </div>
            <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={onClose} aria-label="关闭登录弹窗">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="px-6 pt-5">
            <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="账号操作">
              {[{ value: "login", label: "登录" }, { value: "register", label: "注册" }].map((item) => (
                <button key={item.value} type="button" role="tab" aria-selected={mode === item.value} className={`rounded-md px-4 py-2.5 text-sm font-bold transition ${mode === item.value ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`} onClick={() => { setMode(item.value); setError(""); }}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <form className="space-y-4 px-6 py-5" onSubmit={handleSubmit}>
            {mode === "register" && (
              <label className="block">
                <span className="field-label">昵称</span>
                <input className="field-control mt-2" value={nickname} maxLength={20} autoComplete="nickname" onChange={(event) => { setNickname(event.target.value); setError(""); }} placeholder="请输入昵称" />
              </label>
            )}
            <label className="block">
              <span className="field-label">邮箱</span>
              <input className="field-control mt-2" type="email" value={email} autoComplete="email" onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="name@example.com" required />
            </label>
            <label className="block">
              <span className="field-label">密码</span>
              <input className="field-control mt-2" type="password" value={password} minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="至少 8 位" required />
            </label>
            {mode === "register" && (
              <label className="block">
                <span className="field-label">确认密码</span>
                <input className="field-control mt-2" type="password" value={confirmPassword} minLength={8} autoComplete="new-password" onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }} placeholder="请再次输入至少 8 位密码" required />
              </label>
            )}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-6 text-red-600">{error}</p>}
            <button type="submit" className="btn-primary h-11 w-full py-0 disabled:cursor-not-allowed disabled:bg-slate-300" disabled={submitting}>
              {mode === "login" ? <LogIn size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
              {submitting ? "处理中..." : mode === "login" ? "登录" : "注册并登录"}
            </button>

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-semibold text-slate-400">暂不登录</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-700"><UserRound size={18} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-950">游客体验</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">游客可浏览公开内容并体验 AI 咨询，但不能发帖、评论、评价、点赞、收藏或申请学籍核验。</p>
                  <button type="button" className="btn-secondary mt-3 h-10 bg-white py-0" onClick={handleGuestLogin} disabled={submitting}>进入游客体验</button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
