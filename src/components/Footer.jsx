import React from "react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="container-page flex flex-col gap-3 py-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <p>© 2026 保研领航员 Baoyan Pilot</p>
        <p>当前版本使用模拟数据，不构成最终录取承诺或官方申请建议。</p>
      </div>
    </footer>
  );
}
