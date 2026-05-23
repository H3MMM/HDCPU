import { memo } from 'react';

export const Header = memo(function Header() {
  return (
    <header className="app-header app-header--console">
      <section className="app-header__brand">
        <div className="app-header__brand-copy">
          <p className="eyebrow">CPU 数据通路工作台</p>
          <h1>HDCPU</h1>
          <p className="app-header__hint">RISC-V 多周期与流水线数据通路可视化。</p>
        </div>
      </section>
    </header>
  );
});
