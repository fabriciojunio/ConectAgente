'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-[var(--marcador)]" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-[var(--texto)]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-[var(--texto-claro)]">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
