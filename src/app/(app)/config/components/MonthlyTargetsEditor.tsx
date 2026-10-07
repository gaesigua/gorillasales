'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, AlertCircle, ChevronDown } from 'lucide-react';
import { newTempId } from '@/lib/clientId';
import type { RepMonthlyTarget, SalespersonItem } from '@/lib/types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];


function formatRWF(n: number) {
  return 'RWF ' + n.toLocaleString();
}

interface MonthlyTargetsEditorProps {
  targets: RepMonthlyTarget[];
  salespeople: SalespersonItem[];
  onChange: (targets: RepMonthlyTarget[]) => void;
}

interface FormState {
  salespersonId: string;
  month: number;
  year: number;
  targetAmount: string;
  targetWeightKg: string;
}

const now = new Date();
const YEARS = [-2, -1, 0, 1].map((d) => String(now.getFullYear() + d));
const EMPTY_FORM: FormState = {
  salespersonId: '',
  month: now.getMonth(),
  year: now.getFullYear(),
  targetAmount: '',
  targetWeightKg: '',
};

export default function MonthlyTargetsEditor({ targets, salespeople, onChange }: MonthlyTargetsEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()));

  const nameOf = (id: string) => salespeople.find((s) => s.id === id)?.label ?? targets.find((t) => t.salespersonId === id)?.repName ?? '';

  const filtered = targets.filter(t => {
    const repMatch = !filterRep || t.salespersonId === filterRep;
    const yearMatch = !filterYear || t.year === Number(filterYear);
    return repMatch && yearMatch;
  });

  const validateForm = (form: FormState, excludeId?: string): string => {
    if (!form.salespersonId) return 'Select a rep';
    const amt = Number(form.targetAmount);
    if (!form.targetAmount || isNaN(amt) || amt <= 0) return 'Enter a valid target amount (RWF)';
    const kg = Number(form.targetWeightKg);
    if (!form.targetWeightKg || isNaN(kg) || kg <= 0) return 'Enter a valid weight target (KG)';
    const dup = targets.find(t =>
      t.salespersonId === form.salespersonId &&
      t.month === form.month &&
      t.year === form.year &&
      t.id !== excludeId
    );
    if (dup) return `${nameOf(form.salespersonId)} already has a target for ${MONTHS[form.month]} ${form.year}`;
    return '';
  };

  const startEdit = (t: RepMonthlyTarget) => {
    setEditingId(t.id);
    setEditForm({
      salespersonId: t.salespersonId,
      month: t.month,
      year: t.year,
      targetAmount: String(t.targetAmount),
      targetWeightKg: String(t.targetWeightKg ?? 0),
    });
    setError('');
  };

  const cancelEdit = () => { setEditingId(null); setError(''); };

  const saveEdit = useCallback(() => {
    const err = validateForm(editForm, editingId ?? undefined);
    if (err) { setError(err); return; }
    onChange(targets.map(t => t.id === editingId
      ? {
          ...t,
          salespersonId: editForm.salespersonId,
          repName: nameOf(editForm.salespersonId),
          month: editForm.month,
          year: editForm.year,
          targetAmount: Number(editForm.targetAmount),
          targetWeightKg: Number(editForm.targetWeightKg),
        }
      : t
    ));
    cancelEdit();
  }, [editForm, editingId, targets, onChange]);

  const startAdd = () => {
    setAddingNew(true);
    setNewForm({ ...EMPTY_FORM, salespersonId: salespeople[0]?.id ?? '' });
    setError('');
  };

  const cancelAdd = () => { setAddingNew(false); setError(''); };

  const confirmAdd = useCallback(() => {
    const err = validateForm(newForm);
    if (err) { setError(err); return; }
    const item: RepMonthlyTarget = {
      id: newTempId('mt'),
      salespersonId: newForm.salespersonId,
      repName: nameOf(newForm.salespersonId),
      month: newForm.month,
      year: newForm.year,
      targetAmount: Number(newForm.targetAmount),
      targetWeightKg: Number(newForm.targetWeightKg),
    };
    onChange([...targets, item]);
    cancelAdd();
  }, [newForm, targets, onChange]);

  const deleteItem = (id: string) => {
    onChange(targets.filter(t => t.id !== id));
    setDeleteConfirmId(null);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Monthly Targets per Rep</h3>
          <p className="text-muted-foreground text-xs mt-0.5">Set individual sales targets (RWF value + KG weight) per rep per month.</p>
        </div>
        <button
          onClick={startAdd}
          disabled={addingNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 shrink-0"
        >
          <Plus size={13} />
          Add Target
        </button>
      </div>

      {/* Filters */}
      <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <select
            value={filterRep}
            onChange={e => setFilterRep(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-xs bg-background text-foreground appearance-none pr-7 focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="">All Reps</option>
            {salespeople.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="border border-border rounded-lg px-3 py-1.5 text-xs bg-background text-foreground appearance-none pr-7 focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="">All Years</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-negative/10 border border-negative/20 flex items-center gap-2 text-negative text-xs">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Month</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Year</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target (RWF)</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target (KG)</th>
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* Add new row */}
            {addingNew && (
              <tr className="bg-accent/5 border-b border-accent/20">
                <td className="px-3 py-2">
                  <div className="relative">
                    <select
                      autoFocus
                      value={newForm.salespersonId}
                      onChange={e => { setNewForm(f => ({ ...f, salespersonId: e.target.value })); setError(''); }}
                      className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground appearance-none pr-6 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      <option value="">Select rep…</option>
                      {salespeople.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="relative">
                    <select
                      value={newForm.month}
                      onChange={e => setNewForm(f => ({ ...f, month: Number(e.target.value) }))}
                      className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground appearance-none pr-6 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="relative">
                    <select
                      value={newForm.year}
                      onChange={e => setNewForm(f => ({ ...f, year: Number(e.target.value) }))}
                      className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground appearance-none pr-6 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      {YEARS.map(y => <option key={y} value={Number(y)}>{y}</option>)}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="100000"
                    value={newForm.targetAmount}
                    onChange={e => { setNewForm(f => ({ ...f, targetAmount: e.target.value })); setError(''); }}
                    onKeyDown={e => { if (e.key === 'Escape') cancelAdd(); }}
                    className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground text-right focus:outline-none focus:ring-2 focus:ring-accent/40"
                    placeholder="e.g. 4000000"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={newForm.targetWeightKg}
                    onChange={e => { setNewForm(f => ({ ...f, targetWeightKg: e.target.value })); setError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd(); }}
                    className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground text-right focus:outline-none focus:ring-2 focus:ring-accent/40"
                    placeholder="e.g. 500"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={confirmAdd} className="p-1.5 rounded-lg bg-positive text-white hover:bg-positive/90 transition-colors" title="Save"><Check size={12} /></button>
                    <button onClick={cancelAdd} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors" title="Cancel"><X size={12} /></button>
                  </div>
                </td>
              </tr>
            )}

            {filtered.length === 0 && !addingNew && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  No targets found. Click <strong>Add Target</strong> to create one.
                </td>
              </tr>
            )}

            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-muted/30 transition-colors group">
                {editingId === t.id ? (
                  <>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <select
                          autoFocus
                          value={editForm.salespersonId}
                          onChange={e => { setEditForm(f => ({ ...f, salespersonId: e.target.value })); setError(''); }}
                          className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground appearance-none pr-6 focus:outline-none focus:ring-2 focus:ring-accent/40"
                        >
                          {salespeople.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <select
                          value={editForm.month}
                          onChange={e => setEditForm(f => ({ ...f, month: Number(e.target.value) }))}
                          className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground appearance-none pr-6 focus:outline-none focus:ring-2 focus:ring-accent/40"
                        >
                          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                        </select>
                        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <select
                          value={editForm.year}
                          onChange={e => setEditForm(f => ({ ...f, year: Number(e.target.value) }))}
                          className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground appearance-none pr-6 focus:outline-none focus:ring-2 focus:ring-accent/40"
                        >
                          {YEARS.map(y => <option key={y} value={Number(y)}>{y}</option>)}
                        </select>
                        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="100000"
                        value={editForm.targetAmount}
                        onChange={e => { setEditForm(f => ({ ...f, targetAmount: e.target.value })); setError(''); }}
                        onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }}
                        className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground text-right focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={editForm.targetWeightKg}
                        onChange={e => { setEditForm(f => ({ ...f, targetWeightKg: e.target.value })); setError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground text-right focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={saveEdit} className="p-1.5 rounded-lg bg-positive text-white hover:bg-positive/90 transition-colors" title="Save"><Check size={12} /></button>
                        <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors" title="Cancel"><X size={12} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2.5 text-sm font-medium text-foreground">{t.repName}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{MONTHS[t.month]}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{t.year}</td>
                    <td className="px-4 py-2.5 text-sm font-tabular font-semibold text-foreground text-right">{formatRWF(t.targetAmount)}</td>
                    <td className="px-4 py-2.5 text-sm font-tabular font-semibold text-foreground text-right">{(t.targetWeightKg ?? 0).toLocaleString()} KG</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors" title="Edit"><Pencil size={12} /></button>
                        {deleteConfirmId === t.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-negative font-medium">Delete?</span>
                            <button onClick={() => deleteItem(t.id)} className="p-1 rounded bg-negative text-white text-xs hover:bg-negative/90 transition-colors">Yes</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="p-1 rounded bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmId(t.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-negative hover:bg-negative/10 transition-colors" title="Delete"><Trash2 size={12} /></button>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-border bg-muted/20">
        <span className="text-xs text-muted-foreground">{targets.length} total target{targets.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
