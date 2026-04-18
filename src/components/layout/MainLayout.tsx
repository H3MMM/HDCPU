import { memo, type ReactNode } from 'react';

interface MainLayoutProps {
  leftSidebar: ReactNode;
  center: ReactNode;
  rightSidebar: ReactNode;
}

export const MainLayout = memo(function MainLayout({ leftSidebar, center, rightSidebar }: MainLayoutProps) {
  return (
    <main className="workspace-layout">
      <aside className="workspace-sidebar workspace-sidebar--left">{leftSidebar}</aside>
      <section className="workspace-stage">{center}</section>
      <aside className="workspace-sidebar workspace-sidebar--right">{rightSidebar}</aside>
    </main>
  );
});
