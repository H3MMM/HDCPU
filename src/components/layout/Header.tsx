import { memo, useEffect, useState } from 'react';

interface UserInfo {
  uid: string;
  name: string | null;
}

interface HeaderProps {
  onOpenProgram: () => void;
  onOpenHelp: () => void;
}

export const Header = memo(function Header({ onOpenProgram, onOpenHelp }: HeaderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [pageViews, setPageViews] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { authenticated: boolean; user?: UserInfo }) => {
        if (data.authenticated && data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/stats/pageviews')
      .then((res) => res.json())
      .then((data: { total: number }) => setPageViews(data.total))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/stats/pageview', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer || undefined,
      }),
    }).catch(() => {});
  }, [user]);

  return (
    <header className="app-header app-header--console">
      <section className="app-header__brand">
        <div className="app-header__brand-copy">
          <p className="eyebrow">CPU 数据通路工作台</p>
          <h1>HDCPU</h1>
          <p className="app-header__hint">RISC-V 多周期与流水线数据通路可视化。</p>
        </div>
        <div className="app-header__actions">
          <button
            type="button"
            className="header-action-button"
            onClick={onOpenProgram}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 4L6 2L10 4L14 2V12L10 14L6 12L2 14V4Z" stroke="currentColor" strokeWidth="1.4" fill="none"/>
              <path d="M6 2V12" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M10 4V14" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
            程序输入
          </button>
          <button
            type="button"
            className="header-action-button"
            onClick={onOpenHelp}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M6.5 6.5C6.5 5.67 7.17 5 8 5C8.83 5 9.5 5.67 9.5 6.5C9.5 7.5 8 8 8 8.5V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
            </svg>
            使用帮助
          </button>
          {user && (
            <div className="user-info">
              {pageViews !== null && (
                <span className="page-view-count">浏览量 {pageViews.toLocaleString()}</span>
              )}
              <span className="user-name">{user.name || user.uid}</span>
              <a href="/api/auth/logout" className="user-action">退出登录</a>
            </div>
          )}
        </div>
      </section>
    </header>
  );
});
