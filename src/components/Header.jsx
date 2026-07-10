import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronDown, Compass, LogOut, Menu, UserRound, X } from "lucide-react";
import LoginModal from "./LoginModal.jsx";
import { AUTH_CHANGED_EVENT, getCurrentUser, logout } from "../utils/auth.js";

const navItems = [
  { path: "/", label: "首页" },
  { path: "/assessment", label: "画像评估" },
  { path: "/ai-recommend", label: "AI 院校推荐" },
  { path: "/schools", label: "院校资料库" },
  { path: "/forum", label: "保研论坛" },
];

const navClass = ({ isActive }) =>
  [
    "rounded-md px-3 py-2 text-sm font-semibold transition",
    isActive
      ? "bg-blue-50 text-brand-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");

export default function Header() {
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const accountMenuRef = useRef(null);

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
    if (!accountMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [accountMenuOpen]);

  const handleOpenLogin = () => {
    setLoginOpen(true);
    setOpen(false);
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setAccountMenuOpen(false);
    setOpen(false);
  };

  const userLabel = currentUser?.nickname || currentUser?.phone || "登录 / 注册";
  const accountDescription =
    currentUser?.loginType === "phone"
      ? currentUser.phone
      : currentUser?.loginType === "guest"
        ? "游客模式"
        : "当前账号";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-white">
            <Compass size={20} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold text-slate-950">保研领航员</span>
            <span className="block text-xs font-medium text-slate-500">Baoyan Pilot</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="主导航">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/assessment" className="btn-secondary">
            <Compass size={17} aria-hidden="true" />
            开始评估
          </Link>

          {currentUser ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                onClick={() => setAccountMenuOpen((value) => !value)}
                aria-expanded={accountMenuOpen}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {currentUser.loginType === "guest" ? "游" : "账"}
                </span>
                <span className="max-w-[132px] truncate">{userLabel}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-soft">
                  <div className="rounded-md bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold text-slate-500">当前账号</p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-950">{userLabel}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{accountDescription}</p>
                  </div>
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="btn-primary px-4 py-2.5" onClick={handleOpenLogin}>
              <UserRound size={17} aria-hidden="true" />
              登录 / 注册
            </button>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "关闭导航" : "打开导航"}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <nav className="container-page grid gap-1 py-3" aria-label="移动端导航">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={navClass}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-slate-200 pt-3">
              {currentUser ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">当前账号</p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-950">{userLabel}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{accountDescription}</p>
                  <button type="button" className="btn-secondary mt-3 w-full" onClick={handleLogout}>
                    <LogOut size={16} aria-hidden="true" />
                    退出登录
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-primary w-full" onClick={handleOpenLogin}>
                  <UserRound size={17} aria-hidden="true" />
                  登录 / 注册
                </button>
              )}
            </div>
          </nav>
        </div>
      )}

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={handleLogin} />
    </header>
  );
}
