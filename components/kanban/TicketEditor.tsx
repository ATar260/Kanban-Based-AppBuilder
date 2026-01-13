'use client';

import { useState } from 'react';
import { KanbanTicket, TicketType, TicketPriority, TicketComplexity, TYPE_COLORS, PRIORITY_COLORS } from './types';

interface TicketEditorProps {
  onSave: (ticket: Omit<KanbanTicket, 'id' | 'order'>) => void;
  onCancel: () => void;
  existingTickets: KanbanTicket[];
  initialData?: Partial<KanbanTicket>;
}

export default function TicketEditor({
  onSave,
  onCancel,
  existingTickets,
  initialData,
}: TicketEditorProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [type, setType] = useState<TicketType>(initialData?.type || 'feature');
  const [priority, setPriority] = useState<TicketPriority>(initialData?.priority || 'medium');
  const [complexity, setComplexity] = useState<TicketComplexity>(initialData?.complexity || 'M');
  const [estimatedFiles, setEstimatedFiles] = useState(initialData?.estimatedFiles || 2);
  const [dependencies, setDependencies] = useState<string[]>(initialData?.dependencies || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      type,
      status: 'backlog',
      priority,
      complexity,
      estimatedFiles,
      actualFiles: [],
      dependencies,
      blockedBy: [],
      progress: 0,
      previewAvailable: false,
      retryCount: 0,
      warnings: [],
      userModified: true,
    });
  };

  const toggleDependency = (ticketId: string) => {
    setDependencies(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const types: TicketType[] = ['component', 'feature', 'layout', 'styling', 'integration', 'config'];
  const priorities: TicketPriority[] = ['critical', 'high', 'medium', 'low'];
  const complexities: TicketComplexity[] = ['XS', 'S', 'M', 'L', 'XL'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            {initialData ? 'Edit Task' : 'Add New Task'}
          </h3>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Hero Section with CTA"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what this task should create..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as TicketType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {types.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TicketPriority)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {priorities.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complexity</label>
              <select
                value={complexity}
                onChange={e => setComplexity(e.target.value as TicketComplexity)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {complexities.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Files: {estimatedFiles}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={estimatedFiles}
              onChange={e => setEstimatedFiles(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {existingTickets.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dependencies (tasks that must complete first)
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-200 rounded-md p-2">
                {existingTickets.filter(t => t.status !== 'done').map(ticket => (
                  <label
                    key={ticket.id}
                    className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={dependencies.includes(ticket.id)}
                      onChange={() => toggleDependency(ticket.id)}
                      className="rounded"
                    />
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${TYPE_COLORS[ticket.type]}20`, color: TYPE_COLORS[ticket.type] }}
                    >
                      {ticket.type}
                    </span>
                    <span className="text-sm text-gray-700 truncate">{ticket.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
          >
            {initialData ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
