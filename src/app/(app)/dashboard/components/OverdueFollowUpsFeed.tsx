'use client';

import React from 'react';
import Link from 'next/link';
import type { OverdueFollowUp } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import { useUser } from '@/context/UserContext';

export default function OverdueFollowUpsFeed({ items, today }: { items: OverdueFollowUp[]; today: string }) {
  const { canViewAllReps } = useUser();
  const visibleFollowUps = items;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          
          <h3 className="text-sm font-semibold text-foreground">
            {canViewAllReps ? 'Overdue Follow-ups' : 'My Overdue Follow-ups'}
          </h3>
          <span className="bg-negative text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {visibleFollowUps?.length}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">{today}</span>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {visibleFollowUps?.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No overdue follow-ups. Great work!
          </div>
        ) : (
          visibleFollowUps?.map((fu) => (
            <div
              key={`fu-${fu?.id}`}
              className="px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {fu?.customer}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {canViewAllReps ? `${fu?.salesperson} · ` : ''}{fu?.area}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {fu?.daysOverdue > 0 ? (
                    <Badge
                      label={`${fu?.daysOverdue}d overdue`}
                      variant="error"
                      size="sm"
                      dot
                    />
                  ) : (
                    <Badge label="Due today" variant="warning" size="sm" dot />
                  )}
                  
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                
                <span className="text-[11px] text-muted-foreground">
                  Due {fu?.dueDate} · {fu?.lastOutcome}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <Link href="/customer-management" className="text-xs font-medium text-accent hover:text-accent/80 transition-colors">
          View customers →
        </Link>
      </div>
    </div>
  );
}