'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConfig } from '@/context/ConfigContext';
import LookupTableEditor, { type ConfigItem } from './LookupTableEditor';
import MonthlyTargetsEditor from './MonthlyTargetsEditor';
import CommissionRulesEditor from './CommissionRulesEditor';
import CustomFieldsEditor from './CustomFieldsEditor';
import ProductsEditor from './ProductsEditor';
import { Tag, CheckSquare, Package, TrendingUp, CheckCircle, Info, Target, DollarSign, List, Sparkles, AlertCircle, Users } from 'lucide-react';
import {
  saveCommissionRules,
  saveLookupList,
  saveMonthlyTargets,
  savePipelineStages,
  saveProducts,
} from '@/actions/config';
import type { ActionResult, CommissionRule, ProductItem, RepMonthlyTarget } from '@/lib/types';

type TabId = 'lookup' | 'products' | 'targets' | 'commission' | 'custom-fields';

const TABS: { id: TabId; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'lookup',
    label: 'Lookup Tables',
    icon: <List size={15} />,
    description: 'Manage dropdown lists: customer categories, visit outcomes and pipeline stages. Renaming an entry also updates existing records.',
  },
  {
    id: 'products',
    label: 'Products',
    icon: <Package size={15} />,
    description: 'Manage the product catalogue: list prices and the coffee weight of each unit.',
  },
  {
    id: 'targets',
    label: 'Monthly Targets',
    icon: <Target size={15} />,
    description: 'Set individual monthly sales targets (RWF and KG) per rep per period.',
  },
  {
    id: 'commission',
    label: 'Commission & Bonuses',
    icon: <DollarSign size={15} />,
    description: 'Define commission percentages and flat bonuses triggered at achievement thresholds.',
  },
  {
    id: 'custom-fields',
    label: 'Custom Fields',
    icon: <Sparkles size={15} />,
    description: 'Extend customer, visit, deal, and product records with custom attributes.',
  },
];

interface ConfigAdminClientProps {
  targets: RepMonthlyTarget[];
  commissionRules: CommissionRule[];
}

export default function ConfigAdminClient({ targets: initialTargets, commissionRules: initialRules }: ConfigAdminClientProps) {
  const router = useRouter();
  const { config } = useConfig();
  const [activeTab, setActiveTab] = useState<TabId>('lookup');
  const [status, setStatus] = useState<{ type: 'saved' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Local copies for optimistic editing; re-synced whenever the server sends fresh data
  const [categories, setCategories] = useState<ConfigItem[]>([]);
  const [outcomes, setOutcomes] = useState<ConfigItem[]>([]);
  const [stages, setStages] = useState<ConfigItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>(config.products);
  const [targets, setTargets] = useState<RepMonthlyTarget[]>(initialTargets);
  const [rules, setRules] = useState<CommissionRule[]>(initialRules);

  useEffect(() => {
    setCategories(config.customerCategories.map((c) => ({ id: c.id, label: c.label, sortOrder: c.sortOrder })));
    setOutcomes(config.visitOutcomes.map((c) => ({ id: c.id, label: c.label, sortOrder: c.sortOrder })));
    setStages(
      config.pipelineStages.map((s) => ({ id: s.id, label: s.name, sortOrder: s.sortOrder, meta: String(s.probability) }))
    );
    setProducts(config.products);
  }, [config]);
  useEffect(() => setTargets(initialTargets), [initialTargets]);
  useEffect(() => setRules(initialRules), [initialRules]);

  /** Apply a change optimistically, persist it, and roll back if the server rejects it. */
  async function persist<T>(
    next: T,
    previous: T,
    setLocal: (value: T) => void,
    save: () => Promise<ActionResult<unknown>>
  ) {
    setLocal(next);
    setSaving(true);
    setStatus(null);
    try {
      const res = await save();
      if (!res.success) {
        setLocal(previous);
        setStatus({ type: 'error', message: res.error });
        return;
      }
      setStatus({ type: 'saved', message: 'Saved' });
      setTimeout(() => setStatus((s) => (s?.type === 'saved' ? null : s)), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const activeTabInfo = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin Configuration</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Centrally manage business rules, targets, and lookup tables. Changes apply to everyone immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
          {status?.type === 'saved' && (
            <span className="flex items-center gap-1.5 text-positive text-xs font-semibold px-3 py-1.5 bg-positive-bg rounded-lg border border-positive/20">
              <CheckCircle size={13} />
              Saved
            </span>
          )}
        </div>
      </div>

      {status?.type === 'error' && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-negative-bg border border-negative/20 flex items-start gap-2.5 text-sm text-negative">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {status.message}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Info banner */}
      <div className="mb-5 px-4 py-3 rounded-xl bg-accent/5 border border-accent/20 flex items-start gap-2.5">
        <Info size={15} className="text-accent shrink-0 mt-0.5" />
        <p className="text-sm text-foreground/80">{activeTabInfo.description}</p>
      </div>

      {activeTab === 'lookup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-accent"><Tag size={16} /></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Categories</span>
            </div>
            <LookupTableEditor
              title="Customer Categories"
              description="Segment customers by channel (e.g. Supermarket, Hotel, Wholesale)."
              items={categories}
              idPrefix="cc"
              onChange={(items) =>
                persist(items, categories, setCategories, () =>
                  saveLookupList('CUSTOMER_CATEGORY', items.map((i) => ({ id: i.id, label: i.label })))
                )
              }
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-accent"><CheckSquare size={16} /></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visit Outcomes</span>
            </div>
            <LookupTableEditor
              title="Visit Outcomes"
              description="Possible results of a field sales visit."
              items={outcomes}
              idPrefix="vo"
              onChange={(items) =>
                persist(items, outcomes, setOutcomes, () =>
                  saveLookupList('VISIT_OUTCOME', items.map((i) => ({ id: i.id, label: i.label })))
                )
              }
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-accent"><TrendingUp size={16} /></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline Stages</span>
            </div>
            <LookupTableEditor
              title="Pipeline Stages"
              description="Ordered deal stages. Probability 100 = won, 0 = lost. Stages that still hold deals cannot be removed."
              items={stages}
              idPrefix="pl"
              showMeta
              metaLabel="Probability"
              metaPlaceholder="% e.g. 40"
              onChange={(items) =>
                persist(items, stages, setStages, () =>
                  savePipelineStages(
                    items.map((i) => ({
                      id: i.id,
                      name: i.label,
                      probability: Number(i.meta ?? 0),
                      color: config.pipelineStages.find((s) => s.id === i.id)?.color,
                    }))
                  )
                )
              }
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-accent"><Users size={16} /></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salespeople</span>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted-foreground">
              Salespeople are the active <strong className="text-foreground">Sales Officer</strong> user accounts. Add,
              deactivate or change roles in{' '}
              <Link href="/user-management" className="text-accent underline">
                User Management
              </Link>
              . Payment statuses (Paid, Credit, Pending, Partial, Overdue) are fixed by the system.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <ProductsEditor
          products={products}
          onChange={(items) => persist(items, products, setProducts, () => saveProducts(items))}
        />
      )}

      {activeTab === 'targets' && (
        <MonthlyTargetsEditor
          targets={targets}
          salespeople={config.salespeople}
          onChange={(items) => persist(items, targets, setTargets, () => saveMonthlyTargets(items))}
        />
      )}

      {activeTab === 'commission' && (
        <CommissionRulesEditor
          rules={rules}
          onChange={(items) => persist(items, rules, setRules, () => saveCommissionRules(items))}
        />
      )}

      {activeTab === 'custom-fields' && <CustomFieldsEditor />}
    </div>
  );
}
