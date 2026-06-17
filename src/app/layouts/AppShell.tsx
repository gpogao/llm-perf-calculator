import type { PropsWithChildren } from "react";
import { SidebarNav } from "../../components/layout/SidebarNav";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <SidebarNav />
      <div className="app-shell__main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Engineering Workbench</p>
            <h1>LLM Perf Calculator</h1>
          </div>
          <div className="topbar__chips">
            <span className="chip">DeepSeek V4</span>
            <span className="chip chip--muted">Web / Desktop Ready</span>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

