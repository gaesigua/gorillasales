'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, GripVertical, Check, X, AlertCircle } from 'lucide-react';
import { newTempId } from '@/lib/clientId';

export interface ConfigItem {
  id: string;
  label: string;
  sortOrder?: number;
  meta?: string; // e.g. probability % for pipeline stages
}

interface LookupTableEditorProps {
  title: string;
  description: string;
  items: ConfigItem[];
  idPrefix: string;
  showMeta?: boolean;
  metaLabel?: string;
  metaPlaceholder?: string;
  onChange: (items: ConfigItem[]) => void;
  accentColor?: string;
}

export default function LookupTableEditor({
  title,
  description,
  items,
  idPrefix,
  showMeta = false,
  metaLabel = 'Meta',
  metaPlaceholder = '',
  onChange,
  accentColor = 'bg-accent',
}: LookupTableEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editMeta, setEditMeta] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newMeta, setNewMeta] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const startEdit = (item: ConfigItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditMeta(item.meta ?? '');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditMeta('');
    setError('');
  };

  const saveEdit = useCallback(() => {
    const trimmed = editLabel.trim();
    if (!trimmed) { setError('Name cannot be empty'); return; }
    const duplicate = items.find(i => i.id !== editingId && i.label.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) { setError('This name already exists'); return; }
    onChange(items.map(i => i.id === editingId ? { ...i, label: trimmed, meta: editMeta.trim() || undefined } : i));
    cancelEdit();
  }, [editLabel, editMeta, editingId, items, onChange]);

  const startAdd = () => {
    setAddingNew(true);
    setNewLabel('');
    setNewMeta('');
    setError('');
  };

  const cancelAdd = () => {
    setAddingNew(false);
    setNewLabel('');
    setNewMeta('');
    setError('');
  };

  const confirmAdd = useCallback(() => {
    const trimmed = newLabel.trim();
    if (!trimmed) { setError('Name cannot be empty'); return; }
    const duplicate = items.find(i => i.label.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) { setError('This name already exists'); return; }
    const newItem: ConfigItem = {
      id: newTempId(idPrefix),
      label: trimmed,
      sortOrder: items.length + 1,
      meta: newMeta.trim() || undefined,
    };
    onChange([...items, newItem]);
    cancelAdd();
  }, [newLabel, newMeta, items, idPrefix, onChange]);

  const deleteItem = (id: string) => {
    onChange(items.filter(i => i.id !== id));
    setDeleteConfirmId(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next.map((item, i) => ({ ...item, sortOrder: i + 1 })));
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    const next = [...items];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next.map((item, i) => ({ ...item, sortOrder: i + 1 })));
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
        </div>
        <button
          onClick={startAdd}
          disabled={addingNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 shrink-0"
        >
          <Plus size={13} />
          Add
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-negative/10 border border-negative/20 flex items-center gap-2 text-negative text-xs">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* List */}
      <ul className="divide-y divide-border">
        {items.length === 0 && !addingNew && (
          <li className="px-5 py-8 text-center text-muted-foreground text-sm">
            No items yet. Click <strong>Add</strong> to create the first entry.
          </li>
        )}

        {items.map((item, index) => (
          <li key={item.id} className="px-4 py-2.5 flex items-center gap-2 group hover:bg-muted/30 transition-colors">
            {/* Reorder */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 transition-colors"
                title="Move up"
              >
                <GripVertical size={14} className="rotate-90" />
              </button>
            </div>

            {/* Sort badge */}
            <span className={`w-5 h-5 rounded-full ${accentColor} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
              {index + 1}
            </span>

            {editingId === item.id ? (
              /* Edit mode */
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <input
                  autoFocus
                  value={editLabel}
                  onChange={e => { setEditLabel(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  placeholder="Enter name..."
                />
                {showMeta && (
                  <input
                    value={editMeta}
                    onChange={e => setEditMeta(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    className="w-24 px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                    placeholder={metaPlaceholder}
                  />
                )}
                <div className="flex items-center gap-1">
                  <button onClick={saveEdit} className="p-1.5 rounded-lg bg-positive text-white hover:bg-positive/90 transition-colors" title="Save">
                    <Check size={13} />
                  </button>
                  <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors" title="Cancel">
                    <X size={13} />
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-sm text-foreground truncate flex-1">{item.label}</span>
                {showMeta && item.meta && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                    {metaLabel}: {item.meta}%
                  </span>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => startEdit(item)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  {deleteConfirmId === item.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-negative font-medium">Delete?</span>
                      <button onClick={() => deleteItem(item.id)} className="p-1 rounded bg-negative text-white text-xs hover:bg-negative/90 transition-colors">Yes</button>
                      <button onClick={() => setDeleteConfirmId(null)} className="p-1 rounded bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors">No</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-negative hover:bg-negative/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}

        {/* Add new row */}
        {addingNew && (
          <li className="px-4 py-3 flex items-center gap-2 bg-accent/5 border-t border-accent/20">
            <span className={`w-5 h-5 rounded-full ${accentColor} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}>
              {items.length + 1}
            </span>
            <input
              autoFocus
              value={newLabel}
              onChange={e => { setNewLabel(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd(); }}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-accent/40 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="Enter name..."
            />
            {showMeta && (
              <input
                value={newMeta}
                onChange={e => setNewMeta(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd(); }}
                className="w-24 px-2.5 py-1.5 rounded-lg border border-accent/40 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder={metaPlaceholder}
              />
            )}
            <div className="flex items-center gap-1">
              <button onClick={confirmAdd} className="p-1.5 rounded-lg bg-positive text-white hover:bg-positive/90 transition-colors" title="Add">
                <Check size={13} />
              </button>
              <button onClick={cancelAdd} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors" title="Cancel">
                <X size={13} />
              </button>
            </div>
          </li>
        )}
      </ul>

      {/* Footer count */}
      <div className="px-5 py-2.5 border-t border-border bg-muted/20">
        <span className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? 'entry' : 'entries'}</span>
      </div>
    </div>
  );
}
