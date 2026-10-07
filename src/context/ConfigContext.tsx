'use client';

import React, { createContext, useContext } from 'react';
import type { AppConfig } from '@/lib/types';

const ConfigContext = createContext<AppConfig | null>(null);

/**
 * Org-wide reference data (salespeople, categories, products, stages), loaded from the
 * database by the app layout. Saving changes revalidates the layout, which re-renders
 * this provider with fresh data.
 */
export function ConfigProvider({ config, children }: { config: AppConfig; children: React.ReactNode }) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const config = useContext(ConfigContext);
  if (!config) throw new Error('useConfig must be used inside ConfigProvider');
  return { config };
}
