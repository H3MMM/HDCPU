import { memo } from 'react';

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.24c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.22-3.37-1.22-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.96c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.49A10.13 10.13 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  );
}

export const Header = memo(function Header() {
  return (
    <header className="app-header app-header--console">
      <section className="app-header__brand">
        <div className="app-header__brand-copy">
          <p className="eyebrow">CPU 数据通路工作台</p>
          <h1>HDCPU</h1>
          <p className="app-header__hint">RISC-V 多周期与流水线数据通路可视化。</p>
        </div>

        <a
          className="github-link"
          href="https://github.com/H3MMM/HDCPU"
          target="_blank"
          rel="noreferrer"
          aria-label="打开 HDCPU GitHub 项目"
          title="GitHub"
        >
          <GitHubIcon />
        </a>
      </section>
    </header>
  );
});
