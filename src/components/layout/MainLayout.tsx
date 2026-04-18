import { memo, type ReactNode } from 'react';

interface MainLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
}

export const MainLayout = memo(function MainLayout({ leftColumn, rightColumn }: MainLayoutProps) {
  return (
    <main className="app-grid">
      <aside className="panel-stack">{leftColumn}</aside>
      <section className="panel-stack">{rightColumn}</section>
    </main>
  );
});
