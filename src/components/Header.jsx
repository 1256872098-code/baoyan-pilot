import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Compass, Menu, X } from "lucide-react";

const navItems = [
  { path: "/", label: "首页" },
  { path: "/assessment", label: "画像评估" },
  { path: "/schools", label: "院校资料库" },
  { path: "/review", label: "复习助手" },
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

        <Link to="/assessment" className="btn-secondary hidden md:inline-flex">
          <Compass size={17} aria-hidden="true" />
          开始评估
        </Link>

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
          </nav>
        </div>
      )}
    </header>
  );
}
