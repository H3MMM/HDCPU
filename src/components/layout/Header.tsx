import { memo, useEffect, useState } from 'react';

interface UserInfo {
  uid: string;
  name: string | null;
}

export const Header = memo(function Header() {
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

  return (
    <header className="app-header app-header--console">
      <section className="app-header__brand">
        <div className="app-header__brand-copy">
          <p className="eyebrow">CPU 数据通路工作台</p>
          <h1>HDCPU</h1>
          <p className="app-header__hint">RISC-V 多周期与流水线数据通路可视化。</p>
        </div>
        <div className="app-header__user">
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
