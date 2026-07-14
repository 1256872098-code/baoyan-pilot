import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronDown, Compass, LogOut, Menu, MessageSquareText, UserRound, X } from "lucide-react";
import LoginModal from "./LoginModal.jsx";
import NotificationBell from "./notifications/NotificationBell.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const navItems = [
  { path: "/", label: "首页" },
  { path: "/ai-recommend", label: "AI院校推荐" },
  { path: "/schools", label: "院校资料库" },
  { path: "/my-school", label: "我的院校" },
  { path: "/forum", label: "保研论坛" },
];

const navClass = ({ isActive }) =>
  [
    "rounded-md px-3 py-2 text-sm font-semibold transition",
    isActive ? "bg-blue-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");

export default function Header() {
  const { user, profile, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationCloseKey, setNotificationCloseKey] = useState(0);
  const accountMenuRef = useRef(null);

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

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      window.alert(error?.message || "退出登录失败，请稍后重试。");
    }
    setAccountMenuOpen(false);
    setOpen(false);
  };

  const maskedPhone = user?.phone ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}` : "";
  const userLabel = profile?.nickname || maskedPhone || "登录 / 注册";
  const accountDescription = user?.loginType === "guest" ? "游客体验账号" : maskedPhone || "当前账号";
  const canUseNotifications = Boolean(user?.id && user.loginType === "phone_mock");
  const avatarNode = profile?.avatar_url ? (
    <img className="h-7 w-7 rounded-full object-cover" src={profile.avatar_url} alt="用户头像" />
  ) : (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
      {user?.loginType === "guest" ? "游" : "账"}
    </span>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex shrink-0 items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-white">
            <Compass size={20} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold text-slate-950">保研领航员</span>
            <span className="block text-xs font-medium text-slate-500">Baoyan Pilot</span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex" aria-label="主导航">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-0.5 md:flex">
          {user ? (
            <>
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                  onClick={() =>
                    setAccountMenuOpen((value) => {
                      const nextOpen = !value;
                      if (nextOpen) setNotificationCloseKey((key) => key + 1);
                      return nextOpen;
                    })
                  }
                  aria-expanded={accountMenuOpen}
                >
                  {avatarNode}
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
                    <Link
                      to="/profile"
                      className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <UserRound size={16} aria-hidden="true" />
                      个人中心
                    </Link>
                    <Link
                      to="/forum"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <MessageSquareText size={16} aria-hidden="true" />
                      我的帖子
                    </Link>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} aria-hidden="true" />
                      退出登录
                    </button>
                  </div>
                )}
              </div>
              {canUseNotifications && (
                <NotificationBell
                  user={user}
                  forceCloseKey={notificationCloseKey}
                  onOpen={() => setAccountMenuOpen(false)}
                />
              )}
            </>
          ) : (
            <button type="button" className="btn-primary px-4 py-2.5" onClick={handleOpenLogin}>
              <UserRound size={17} aria-hidden="true" />
              {loading ? "检查登录中" : "登录 / 注册"}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 md:hidden">
          {user && <span className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white">{avatarNode}</span>}
          {canUseNotifications && (
            <NotificationBell
              user={user}
              forceCloseKey={notificationCloseKey}
              onOpen={() => {
                setAccountMenuOpen(false);
                setOpen(false);
              }}
            />
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700"
            onClick={() => {
              setNotificationCloseKey((key) => key + 1);
              setOpen((value) => !value);
            }}
            aria-label={open ? "关闭导航" : "打开导航"}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <nav className="container-page grid gap-1 py-3" aria-label="移动端导航">
            {navItems.map((item) => (
              <NavLink key={item.path} to={item.path} className={navClass} onClick={() => setOpen(false)}>
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-slate-200 pt-3">
              {user ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">当前账号</p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-950">{userLabel}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{accountDescription}</p>
                  <Link className="btn-secondary mt-3 w-full" to="/profile" onClick={() => setOpen(false)}>
                    <UserRound size={16} aria-hidden="true" />
                    个人中心
                  </Link>
                  <Link className="btn-secondary mt-2 w-full" to="/forum" onClick={() => setOpen(false)}>
                    <MessageSquareText size={16} aria-hidden="true" />
                    我的帖子
                  </Link>
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

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  );
}
