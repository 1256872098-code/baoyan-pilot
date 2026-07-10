import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogIn, MessageCircle, UserRound, X } from "lucide-react";
import { loginAsGuest, loginWithPhone } from "../utils/auth.js";

const phonePattern = /^1\d{10}$/;
const codePattern = /^\d{6}$/;

export default function LoginModal({ open, onClose, onLogin }) {
  const modalRef = useRef(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
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
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleGetCode = () => {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      setError("请先输入手机号");
      setNotice("");
      return;
    }

    if (!phonePattern.test(normalizedPhone)) {
      setError("请输入正确的手机号");
      setNotice("");
      return;
    }

    setError("");
    setNotice("验证码已模拟发送，第一阶段输入任意 6 位数字即可登录。");
  };

  const handlePhoneLogin = () => {
    const normalizedPhone = phone.trim();
    const normalizedCode = code.trim();

    if (!normalizedPhone) {
      setError("请先输入手机号");
      return;
    }

    if (!phonePattern.test(normalizedPhone)) {
      setError("请输入正确的手机号");
      return;
    }

    if (!normalizedCode) {
      setError("请输入验证码");
      return;
    }

    if (!codePattern.test(normalizedCode)) {
      setError("请输入 6 位验证码");
      return;
    }

    const user = loginWithPhone(normalizedPhone);
    onLogin(user);
    onClose();
  };

  const handleGuestLogin = () => {
    const user = loginAsGuest();
    window.alert("已进入游客体验。游客模式的数据仅保存在当前浏览器。");
    onLogin(user);
    onClose();
  };

  const handleWechatLogin = () => {
    // TODO: integrate WeChat OAuth login
    window.alert("微信登录功能即将开放，当前请先使用手机号或游客体验。");
  };

  const handleQqLogin = () => {
    // TODO: integrate QQ OAuth login
    window.alert("QQ 登录功能即将开放，当前请先使用手机号或游客体验。");
  };

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/45">
      <div className="flex min-h-dvh items-center justify-center px-4 py-6">
        <div
          ref={modalRef}
          className="w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white shadow-2xl max-h-[calc(100dvh-48px)]"
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
            <label className="block">
              <span className="field-label">手机号</span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                type="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setNotice("");
                }}
                inputMode="tel"
                placeholder="请输入手机号"
              />
            </label>

            <label className="block">
              <span className="field-label">验证码</span>
              <div className="mt-2 flex gap-2">
                <input
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="任意 6 位数字"
                />
                <button type="button" className="btn-secondary h-11 shrink-0 px-3 py-0" onClick={handleGetCode}>
                  获取验证码
                </button>
              </div>
            </label>

            {notice && <p className="text-sm leading-6 text-brand-700">{notice}</p>}
            {error && <p className="text-sm leading-6 text-red-600">{error}</p>}

            <button type="button" className="btn-primary h-11 w-full py-0" onClick={handlePhoneLogin}>
              <LogIn size={17} aria-hidden="true" />
              手机号登录
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

            <div className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-brand-300 hover:bg-blue-50">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <UserRound size={18} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-bold text-slate-950">游客体验</span>
                  <span className="mt-0.5 block text-sm text-slate-500">数据仅保存在当前浏览器</span>
                </span>
              </span>
              <button type="button" className="btn-secondary h-10 px-4 py-0" onClick={handleGuestLogin}>
                进入
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
