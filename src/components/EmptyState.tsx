import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  /** Heading level: 1 when the empty state is the whole page. */
  level?: 1 | 2 | 3;
}

export function EmptyState({ icon, title, children, action, level = 3 }: Props) {
  const H = `h${level}` as const;
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <H>{title}</H>
      <p>{children}</p>
      {action}
    </div>
  );
}
