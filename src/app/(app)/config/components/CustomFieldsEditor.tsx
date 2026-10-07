'use client';

import React, { useState, useEffect } from 'react';
import { getCustomFieldDefinitions, createCustomFieldDefinition, CustomFieldDefinitionDTO } from '@/actions/customFields';
import { Plus, Sliders, CheckCircle, Sparkles, Layers, Type, Hash, Calendar, List, CheckSquare } from 'lucide-react';
import Badge from '@/components/ui/Badge';

type EntityType = 'CUSTOMER' | 'VISIT_LOG' | 'DEAL' | 'PRODUCT';

const ENTITIES: { id: EntityType; label: string; description: string }[] = [
  { id: 'CUSTOMER', label: 'Customers', description: 'Extend customer profiles with custom business fields.' },
  { id: 'VISIT_LOG', label: 'Visit Logs', description: 'Add custom data fields recorded during field visits.' },
  { id: 'DEAL', label: 'Pipeline Deals', description: 'Add custom deal metrics or contract attributes.' },
  { id: 'PRODUCT', label: 'Products', description: 'Add technical specifications or custom tags to products.' },
];

export default function CustomFieldsEditor() {
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('CUSTOMER');
  const [fields, setFields] = useState<CustomFieldDefinitionDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Form state
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'BOOLEAN' | 'MULTI_SELECT'>('TEXT');
  const [optionsStr, setOptionsStr] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadFields();
  }, [selectedEntity]);

  const loadFields = async () => {
    setLoading(true);
    const result = await getCustomFieldDefinitions(selectedEntity);
    setFields(result);
    setLoading(false);
  };

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldName.trim()) return;

    setSaving(true);
    setMessage(null);

    const options = fieldType === 'SELECT' || fieldType === 'MULTI_SELECT'
      ? optionsStr.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;

    const res = await createCustomFieldDefinition({
      entityType: selectedEntity,
      name: fieldName.trim(),
      fieldType,
      options,
      isRequired,
    });

    setSaving(false);

    if (res.success && res.definition) {
      setFields((prev) => [...prev, res.definition!]);
      setShowModal(false);
      setFieldName('');
      setOptionsStr('');
      setIsRequired(false);
      setMessage('Custom field created successfully!');
      setTimeout(() => setMessage(null), 3000);
    } else {
      alert(res.error || 'Failed to create custom field');
    }
  };

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'NUMBER': return <Hash size={14} className="text-info" />;
      case 'DATE': return <Calendar size={14} className="text-warning" />;
      case 'SELECT':
      case 'MULTI_SELECT': return <List size={14} className="text-accent" />;
      case 'BOOLEAN': return <CheckSquare size={14} className="text-positive" />;
      default: return <Type size={14} className="text-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-accent/10 via-primary/5 to-transparent border border-accent/20 rounded-2xl p-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent animate-pulse" />
            <h2 className="text-base font-bold text-foreground">Twenty CRM Dynamic Custom Fields Engine</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Extend any entity schema on-the-fly without database migrations or code modifications. Custom fields automatically surface across entry forms and reports.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-all shadow-sm"
        >
          <Plus size={15} />
          Create Custom Field
        </button>
      </div>

      {message && (
        <div className="p-3 bg-positive/10 border border-positive/20 text-positive rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle size={15} />
          {message}
        </div>
      )}

      {/* Entity Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ENTITIES.map((ent) => (
          <button
            key={ent.id}
            onClick={() => setSelectedEntity(ent.id)}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              selectedEntity === ent.id
                ? 'bg-card border-accent shadow-sm ring-1 ring-accent/30'
                : 'bg-card/50 border-border hover:bg-card hover:border-border/80'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-bold ${selectedEntity === ent.id ? 'text-accent' : 'text-foreground'}`}>
                {ent.label}
              </span>
              <Layers size={14} className={selectedEntity === ent.id ? 'text-accent' : 'text-muted-foreground'} />
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2">{ent.description}</p>
          </button>
        ))}
      </div>

      {/* Fields List Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {ENTITIES.find((e) => e.id === selectedEntity)?.label} Fields ({fields.length})
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Active schema extension definitions</p>
          </div>
          <Badge variant="accent">{selectedEntity}</Badge>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading custom fields...</div>
        ) : fields.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
              <Sliders size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No Custom Fields Yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Add custom attributes to customize {selectedEntity.toLowerCase()} records for your enterprise business rules.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90"
            >
              <Plus size={14} />
              Add First Field
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {fields.map((f) => (
              <div key={f.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted border border-border">
                    {getFieldTypeIcon(f.fieldType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{f.name}</span>
                      {f.isRequired && (
                        <span className="text-[10px] bg-negative/10 text-negative px-1.5 py-0.5 rounded font-medium">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">key: {f.fieldKey}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant="neutral">{f.fieldType}</Badge>
                  {f.options && f.options.length > 0 && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      Options: {f.options.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Field Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Create Custom Field</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Entity: {selectedEntity}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <form onSubmit={handleCreateField} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Field Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Machine Serial Number"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Field Data Type *</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="TEXT">Text (Short Input)</option>
                  <option value="NUMBER">Number (Numeric values)</option>
                  <option value="DATE">Date Picker</option>
                  <option value="SELECT">Select Dropdown</option>
                  <option value="BOOLEAN">Checkbox / Boolean</option>
                  <option value="MULTI_SELECT">Multi-Select List</option>
                </select>
              </div>

              {(fieldType === 'SELECT' || fieldType === 'MULTI_SELECT') && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Dropdown Options (Comma separated) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Option A, Option B, Option C"
                    value={optionsStr}
                    onChange={(e) => setOptionsStr(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="req"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
                <label htmlFor="req" className="text-xs text-foreground font-medium cursor-pointer">
                  Is this field required?
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
