'use client';

import { useState } from 'react';
import { KanbanTicket, InputRequest } from './types';

interface InputRequestModalProps {
  ticket: KanbanTicket;
  onSubmit: (ticketId: string, inputs: Record<string, string>) => void;
  onCancel: () => void;
  onSkip: () => void;
}

export default function InputRequestModal({
  ticket,
  onSubmit,
  onCancel,
  onSkip,
}: InputRequestModalProps) {
  const [inputs, setInputs] = useState<Record<string, string>>(ticket.userInputs || {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (id: string, value: string) => {
    setInputs(prev => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[id];
        return newErrors;
      });
    }
  };

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const validateApiKey = (key: string): boolean => {
    return key.length >= 10 && /^[a-zA-Z0-9_-]+$/.test(key);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    ticket.inputRequests?.forEach(req => {
      const value = inputs[req.id]?.trim();
      
      if (req.required && !value) {
        newErrors[req.id] = `${req.label} is required`;
        return;
      }
      
      if (value) {
        if (req.type === 'url' && !validateUrl(value)) {
          newErrors[req.id] = 'Please enter a valid URL (e.g., https://example.com)';
        } else if (req.type === 'api_key' && !validateApiKey(value)) {
          newErrors[req.id] = 'API key should be at least 10 characters with only letters, numbers, underscores, or hyphens';
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit(ticket.id, inputs);
    }
  };

  const getInputType = (request: InputRequest) => {
    if (request.sensitive) return 'password';
    if (request.type === 'url') return 'url';
    return 'text';
  };

  const getInputIcon = (type: InputRequest['type']) => {
    switch (type) {
      case 'api_key':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
        );
      case 'credential':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        );
      case 'url':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        );
      case 'env_var':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Input Required</h2>
              <p className="text-sm text-gray-500">{ticket.title}</p>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <p className="text-sm text-gray-600 mb-4">
            This feature requires the following configuration to work properly:
          </p>

          <div className="space-y-4">
            {ticket.inputRequests?.map(request => (
              <div key={request.id} className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <span className="text-gray-400">{getInputIcon(request.type)}</span>
                  {request.label}
                  {request.required && <span className="text-red-500">*</span>}
                </label>
                {request.description && (
                  <p className="text-xs text-gray-500 ml-6">{request.description}</p>
                )}
                <div className="relative">
                  <input
                    type={getInputType(request)}
                    value={inputs[request.id] || ''}
                    onChange={(e) => handleInputChange(request.id, e.target.value)}
                    placeholder={request.placeholder}
                    className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors
                      ${errors[request.id] 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                      }
                      focus:outline-none focus:ring-2`}
                  />
                  {request.sensitive && inputs[request.id] && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    </div>
                  )}
                </div>
                {errors[request.id] && (
                  <p className="text-xs text-red-500 ml-1">{errors[request.id]}</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <p className="text-xs text-blue-700">
                Your credentials are stored locally and used only for this build session. 
                They will be passed securely to the generated code.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip this feature
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
            >
              Save & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
