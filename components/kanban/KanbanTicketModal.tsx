'use client';

import { useState } from 'react';
import { KanbanTicket, TYPE_COLORS, PRIORITY_COLORS } from './types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface KanbanTicketModalProps {
  ticket: KanbanTicket;
  onClose: () => void;
  onEdit: (updates: Partial<KanbanTicket>) => void;
  onSkip: () => void;
  onRetry: () => void;
  onDelete: () => void;
}

export default function KanbanTicketModal({
  ticket,
  onClose,
  onEdit,
  onSkip,
  onRetry,
  onDelete,
}: KanbanTicketModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'code' | 'notes'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(ticket.title);
  const [editedDescription, setEditedDescription] = useState(ticket.description);
  const [userNotes, setUserNotes] = useState(ticket.userNotes || '');

  const handleSaveEdit = () => {
    onEdit({
      title: editedTitle,
      description: editedDescription,
      userNotes,
    });
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ backgroundColor: `${TYPE_COLORS[ticket.type]}20`, color: TYPE_COLORS[ticket.type] }}
            >
              {ticket.type}
            </span>
            <span
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ backgroundColor: `${PRIORITY_COLORS[ticket.priority]}20`, color: PRIORITY_COLORS[ticket.priority] }}
            >
              {ticket.priority}
            </span>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
              {ticket.complexity}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              ticket.status === 'done' ? 'bg-green-100 text-green-700' :
              ticket.status === 'failed' ? 'bg-red-100 text-red-700' :
              ticket.status === 'generating' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {ticket.status}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex">
            {['details', 'code', 'notes'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'details' && (
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={e => setEditedTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={editedDescription}
                      onChange={e => setEditedDescription(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{ticket.title}</h3>
                    <p className="mt-2 text-gray-600">{ticket.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Estimated Files:</span>
                      <span className="ml-2 font-medium">{ticket.estimatedFiles}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Actual Files:</span>
                      <span className="ml-2 font-medium">{ticket.actualFiles.length}</span>
                    </div>
                    {ticket.duration && (
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <span className="ml-2 font-medium">{Math.round(ticket.duration / 1000)}s</span>
                      </div>
                    )}
                    {ticket.retryCount > 0 && (
                      <div>
                        <span className="text-gray-500">Retries:</span>
                        <span className="ml-2 font-medium">{ticket.retryCount}</span>
                      </div>
                    )}
                  </div>

                  {ticket.actualFiles.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Generated Files</h4>
                      <div className="space-y-1">
                        {ticket.actualFiles.map(file => (
                          <div key={file} className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">
                            {file}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {ticket.dependencies.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Dependencies</h4>
                      <div className="flex flex-wrap gap-2">
                        {ticket.dependencies.map(dep => (
                          <span key={dep} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {dep}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {ticket.error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <h4 className="text-sm font-medium text-red-700 mb-1">Error</h4>
                      <p className="text-sm text-red-600">{ticket.error}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'code' && (
            <div>
              {ticket.generatedCode ? (
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  <SyntaxHighlighter
                    language="jsx"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      fontSize: '0.75rem',
                      maxHeight: '400px',
                    }}
                    showLineNumbers
                  >
                    {ticket.generatedCode}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No code generated yet
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              <textarea
                value={userNotes}
                onChange={e => setUserNotes(e.target.value)}
                placeholder="Add your notes here..."
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => onEdit({ userNotes })}
                className="mt-2 px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
              >
                Save Notes
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-between">
          <div className="flex gap-2">
            {ticket.status === 'backlog' && (
              <>
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={onSkip}
                  className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-sm rounded-md hover:bg-yellow-200"
                >
                  Skip
                </button>
                <button
                  onClick={onDelete}
                  className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200"
                >
                  Delete
                </button>
              </>
            )}
            {ticket.status === 'failed' && (
              <>
                <button
                  onClick={onRetry}
                  className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600"
                >
                  Retry
                </button>
                <button
                  onClick={onSkip}
                  className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-sm rounded-md hover:bg-yellow-200"
                >
                  Skip
                </button>
              </>
            )}
            {ticket.status === 'done' && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
              >
                Regenerate
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
