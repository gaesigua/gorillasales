'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, AlertCircle, GripVertical, ChevronDown } from 'lucide-react';
import { newTempId } from '@/lib/clientId';
import type { CommissionRule } from '@/lib/types';

interface CommissionRulesEditorProps {
  rules: CommissionRule[];
  onChange: (rules: CommissionRule[]) => void;
}

interface FormState {
  name: string;
  type: 'percentage' | 'flat';
  value: string;
  thresholdPct: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'percentage',
  value: '',
  thresholdPct: '0',
  description: '',
};

function typeLabel(type: 'percentage' | 'flat') {
  return type === 'percentage' ? '%' : 'RWF flat';
}

export default function CommissionRulesEditor({ rules, onChange }: CommissionRulesEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const validateForm = (form: FormState, excludeId?: string): string => {
    if (!form.name.trim()) return 'Rule name is required';
    const val = Number(form.value);
    if (!form.value || isNaN(val) || val < 0) return 'Enter a valid value (≥ 0)';
    const thr = Number(form.thresholdPct);
    if (isNaN(thr) || thr < 0) return 'Threshold must be 0 or higher';
    const dup = rules.find(r => r.name.toLowerCase() === form.name.trim().toLowerCase() && r.id !== excludeId);
    if (dup) return 'A rule with this name already exists';
    return '';
  };

  const startEdit = (r: CommissionRule) => {
    setEditingId(r.id);
    setEditForm({ name: r.name, type: r.type, value: String(r.value), thresholdPct: String(r.thresholdPct), description: r.description });
    setError('');
  };

  const cancelEdit = () => { setEditingId(null); setError(''); };

  const saveEdit = useCallback(() => {
    const err = validateForm(editForm, editingId ?? undefined);
    if (err) { setError(err); return; }
    onChange(rules.map(r => r.id === editingId
      ? { ...r, name: editForm.name.trim(), type: editForm.type, value: Number(editForm.value), thresholdPct: Number(editForm.thresholdPct), description: editForm.description.trim() }
      : r
    ));
    cancelEdit();
  }, [editForm, editingId, rules, onChange]);

  const startAdd = () => { setAddingNew(true); setNewForm(EMPTY_FORM); setError(''); };
  const cancelAdd = () => { setAddingNew(false); setError(''); };

  const confirmAdd = useCallback(() => {
    const err = validateForm(newForm);
    if (err) { setError(err); return; }
    const item: CommissionRule = {
      id: newTempId('cr'),
      name: newForm.name.trim(),
      type: newForm.type,
      value: Number(newForm.value),
      thresholdPct: Number(newForm.thresholdPct),
      description: newForm.description.trim(),
      sortOrder: rules.length + 1,
    };
    onChange([...rules, item]);
    cancelAdd();
  }, [newForm, rules, onChange]);

  const deleteItem = (id: string) => { onChange(rules.filter(r => r.id !== id)); setDeleteConfirmId(null); };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...rules];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next.map((r, i) => ({ ...r, sortOrder: i + 1 })));
  };

  const FormRow = ({ form, setForm, onSave, onCancel, isNew }: {
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    onSave: () => void;
    onCancel: () => void;
    isNew?: boolean;
  }) => (
    <tr className={`${isNew ? 'bg-accent/5 border-b border-accent/20' : 'bg-muted/10'}`}>
      <td className="px-3 py-2" colSpan={5}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Rule Name</label>
            <input
              autoFocus={isNew}
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
              className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="e.g. Base Commission"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Type</label>
            <div className="relative">
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'percentage' | 'flat' }))}
                className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground appearance-none pr-6 focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (RWF)</option>
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
              Value {form.type === 'percentage' ? '(%)' : '(RWF)'}
            </label>
            <input
              type="number"
              min="0"
              step={form.type === 'percentage' ? '0.1' : '1000'}
              value={form.value}
              onChange={e => { setForm(f => ({ ...f, value: e.target.value })); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
              className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder={form.type === 'percentage' ? 'e.g. 2.5' : 'e.g. 50000'}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Min Achievement %</label>
            <input
              type="number"
              min="0"
              max="200"
              step="5"
              value={form.thresholdPct}
              onChange={e => { setForm(f => ({ ...f, thresholdPct: e.target.value })); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
              className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="0 = always applies"
            />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Description</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
              className="w-full border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="Short description of when this rule applies…"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            <button onClick={onSave} className="p-1.5 rounded-lg bg-positive text-white hover:bg-positive/90 transition-colors" title="Save"><Check size={13} /></button>
            <button onClick={onCancel} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors" title="Cancel"><X size={13} /></button>
          </div>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Commission &amp; Bonus Rules</h3>
          <p className="text-muted-foreground text-xs mt-0.5">Define commission percentages and flat bonuses triggered at specific achievement thresholds.</p>
        </div>
        <button
          onClick={startAdd}
          disabled={addingNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 shrink-0"
        >
          <Plus size={13} />
          Add Rule
        </button>
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
              <th className="w-8 px-3 py-2.5"></th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rule</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Min Achievement</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Description</th>
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* Add new */}
            {addingNew && (
              <FormRow form={newForm} setForm={setNewForm} onSave={confirmAdd} onCancel={cancelAdd} isNew />
            )}

            {rules.length === 0 && !addingNew && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                  No rules yet. Click <strong>Add Rule</strong> to create the first commission rule.
                </td>
              </tr>
            )}

            {rules.map((rule, index) => (
              editingId === rule.id ? (
                <FormRow key={rule.id} form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={cancelEdit} />
              ) : (
                <tr key={rule.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 transition-colors"
                      title="Move up"
                    >
                      <GripVertical size={14} className="rotate-90" />
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center shrink-0">{index + 1}</span>
                      <span className="font-semibold text-foreground text-sm">{rule.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${rule.type === 'percentage' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                      {rule.type === 'percentage' ? 'Percentage' : 'Flat'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-tabular font-semibold text-foreground">
                    {rule.type === 'percentage' ? `${rule.value}%` : `RWF ${rule.value.toLocaleString()}`}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {rule.thresholdPct === 0
                      ? <span className="text-xs text-muted-foreground">Always</span>
                      : <span className="text-xs font-semibold text-foreground">≥ {rule.thresholdPct}%</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">{rule.description}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(rule)} className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors" title="Edit"><Pencil size={12} /></button>
                      {deleteConfirmId === rule.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-negative font-medium">Delete?</span>
                          <button onClick={() => deleteItem(rule.id)} className="p-1 rounded bg-negative text-white text-xs hover:bg-negative/90 transition-colors">Yes</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="p-1 rounded bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(rule.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-negative hover:bg-negative/10 transition-colors" title="Delete"><Trash2 size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-border bg-muted/20 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
        <span className="text-xs text-muted-foreground">Rules are evaluated in order — higher rows take priority</span>
      </div>
    </div>
  );
}
