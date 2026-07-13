import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogIn, MessageCircle, UserRound, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";

const phonePattern = /^1\d{10}$/;
const mockCode = "123456";

export default function LoginModal({ open, onClose }) {
  const modalRef = useRef(null);
  const { loginWithPhone, loginAsGuest, signInWithQQ, signInWithWeChat } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    modalRef.current?.scrollTo({ top: 0 });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setError("");
      setNotice("");
      setCode("");
      setPhone("");
      setAgreed(false);
      setCountdown(0);
      setSending(false);
      setVerifying(false);
    }
  }, [open]);

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCountdown((value) => Math.max(value - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const normalizedPhone = phone.replace(/\D/g, "");

  const validatePhone = () => {
    if (!normalizedPhone) {
      setError("请先输入手机号。");
      return false;
    }

    if (!phonePattern.test(normalizedPhone)) {
      setError("请输入 11 位中国大陆手机号。");
      return false;
    }

    return true;
  };

  const handleGetCode = () => {
    if (!validatePhone()) return;
    if (!agreed) {
      setError("请先勾选用户协议和隐私政策。");
      return;
    }

    setSending(true);
    setError("");
    window.setTimeout(() => {
      setNotice("体验版模拟登录，不会发送真实短信。测试验证码：123456");
      setCountdown(60);
      setSending(false);
    }, 250);
  };

  const handlePhoneLogin = async () => {
    if (!validatePhone()) return;
    if (!agreed) {
      setError("请先勾选用户协议和隐私政策。");
      return;
    }

    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError("请输入验证码。");
      return;
    }

    if (normalizedCode !== mockCode) {
      setError("测试验证码不正确，请输入 123456。");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      await loginWithPhone(normalizedPhone);
      onClose();
    } catch (loginError) {
      setError(loginError?.message || "体验登录失败，请稍后重试。");
    } finally {
      setVerifying(false);
    }
  };

  const handleGuestLogin = async () => {
    setVerifying(true);
    setError("");

    try {
      await loginAsGuest();
      onClose();
    } catch (guestError) {
      setError(guestError?.message || "游客体验登录失败，请稍后重试。");
    } finally {
      setVerifying(false);
    }
  };

  const handleWechatLogin = async () => {
    try {
      await signInWithWeChat();
    } catch (wechatError) {
      setNotice(wechatError?.message || "微信登录暂未开放，请使用手机号体验登录。");
      setError("");
    }
  };

  const handleQqLogin = async () => {
    try {
      await signInWithQQ();
    } catch (qqError) {
      setNotice(qqError?.message || "QQ 登录暂未开放，请使用手机号体验登录。");
      setError("");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/45">
      <div className="flex min-h-dvh items-center justify-center px-4 py-6">
        <div
          ref={modalRef}
          className="max-h-[calc(100dvh-48px)] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">登录 / 注册</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">登录后可保存你的保研咨询记录。</p>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={onClose}
              aria-label="关闭登录弹窗"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
              当前为产品体验版，登录信息仅保存在当前浏览器，不代表真实身份认证。
            </div>

            <label className="block">
              <span className="field-label">手机号</span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                type="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setNotice("");
                  setError("");
                }}
                inputMode="tel"
                placeholder="请输入手机号"
              />
            </label>

            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
              <input
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>我已阅读并同意用户协议和隐私政策。</span>
            </label>

            <label className="block">
              <span className="field-label">验证码</span>
              <div className="mt-2 flex gap-2">
                <input
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  type="text"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError("");
                  }}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="请输入测试验证码"
                />
                <button
                  type="button"
                  className="btn-secondary h-11 shrink-0 px-3 py-0 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  onClick={handleGetCode}
                  disabled={sending || countdown > 0}
                >
                  {sending ? "准备中..." : countdown > 0 ? `${countdown}s` : "获取验证码"}
                </button>
              </div>
            </label>

            {notice && <p className="text-sm leading-6 text-brand-700">{notice}</p>}
            {error && <p className="text-sm leading-6 text-red-600">{error}</p>}

            <button
              type="button"
              className="btn-primary h-11 w-full py-0 disabled:cursor-not-allowed disabled:bg-slate-300"
              onClick={handlePhoneLogin}
              disabled={verifying}
            >
              <LogIn size={17} aria-hidden="true" />
              {verifying ? "登录中..." : "手机号体验登录"}
            </button>

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-semibold text-slate-400">或使用其他方式登录</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" className="btn-secondary h-11 w-full justify-center py-0" onClick={handleWechatLogin}>
                <MessageCircle size={17} aria-hidden="true" />
                微信登录
              </button>
              <button type="button" className="btn-secondary h-11 w-full justify-center py-0" onClick={handleQqLogin}>
                <span className="flex h-4 w-4 items-center justify-center text-xs font-bold">QQ</span>
                QQ 登录
              </button>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-700">
                  <UserRound size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-950">游客体验</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    可浏览功能并体验 AI 咨询；游客不能在论坛发帖和回复，数据仅保存在当前浏览器。
                  </p>
                  <button type="button" className="btn-secondary mt-3 h-10 bg-white py-0" onClick={handleGuestLogin}>
                    进入游客体验
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
