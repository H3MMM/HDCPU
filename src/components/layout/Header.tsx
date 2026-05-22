import { memo } from 'react';
import { useAuth } from '../../auth/useAuth';

export const Header = memo(function Header() {
  const { authenticated, user, loading, logout } = useAuth();

  return (
    <header className="app-header app-header--console">
      <section className="app-header__brand">
        <div className="app-header__brand-copy">
          <p className="eyebrow">CPU 数据通路工作台</p>
          <h1>HDCPU</h1>
          <p className="app-header__hint">RISC-V 多周期与流水线数据通路可视化。</p>
        </div>

        <div className="app-header__user">
          {loading ? (
            <span className="user-status">...</span>
          ) : authenticated && user ? (
            <div className="user-info">
              <span className="user-name">{user.name || user.uid}</span>
              <button type="button" className="user-action" onClick={logout}>
                退出登录
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </header>
  );
});
