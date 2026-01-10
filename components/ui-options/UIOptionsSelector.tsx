'use client';

import { useState } from 'react';

export interface UIOption {
  id: string;
  name: string;
  description: string;
  style: string;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  layout: string;
  features: string[];
  previewPrompt: string;
}

interface UIOptionsSelectorProps {
  options: UIOption[];
  onSelect: (option: UIOption) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function UIOptionsSelector({
  options,
  onSelect,
  onCancel,
  isLoading = false,
}: UIOptionsSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSelect = () => {
    const selected = options.find(opt => opt.id === selectedId);
    if (selected) {
      onSelect(selected);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-5xl w-full mx-4 shadow-2xl">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Generating UI Options</h2>
            <p className="text-gray-500">Creating 3 unique design approaches for your app...</p>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-[4/3] bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 max-w-6xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center px-3 py-1.5 mb-4 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-full border border-emerald-300">
            3 Design Options
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Design Style</h2>
          <p className="text-gray-500">Select one of these 3 unique UI approaches for your application</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {options.slice(0, 3).map((option, index) => (
            <div
              key={option.id}
              onClick={() => setSelectedId(option.id)}
              onMouseEnter={() => setHoveredId(option.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                relative rounded-xl border-2 cursor-pointer transition-all duration-300
                ${selectedId === option.id
                  ? 'border-emerald-500 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                  : hoveredId === option.id
                    ? 'border-emerald-300 shadow-md'
                    : 'border-gray-200'
                }
              `}
            >
              {selectedId === option.id && (
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg z-10">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}

              <div
                className="aspect-[4/3] rounded-t-xl relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${option.colorScheme.primary}, ${option.colorScheme.secondary})` }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-3/4 h-3/4 rounded-lg shadow-xl"
                    style={{ backgroundColor: option.colorScheme.background }}
                  >
                    <div className="p-4">
                      <div
                        className="h-3 w-1/2 rounded mb-2"
                        style={{ backgroundColor: option.colorScheme.primary }}
                      />
                      <div
                        className="h-2 w-3/4 rounded mb-1"
                        style={{ backgroundColor: option.colorScheme.text + '40' }}
                      />
                      <div
                        className="h-2 w-2/3 rounded"
                        style={{ backgroundColor: option.colorScheme.text + '30' }}
                      />
                      <div
                        className="mt-4 h-6 w-1/3 rounded"
                        style={{ backgroundColor: option.colorScheme.accent }}
                      />
                    </div>
                  </div>
                </div>
                <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-gray-700">
                  Option {index + 1}
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{option.name}</h3>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{option.description}</p>

                <div className="flex flex-wrap gap-1 mb-3">
                  {option.features.slice(0, 3).map((feature, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: option.colorScheme.primary + '15',
                        color: option.colorScheme.primary
                      }}
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                <div className="flex gap-1">
                  {Object.values(option.colorScheme).slice(0, 5).map((color, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border border-gray-200"
                      style={{ backgroundColor: color }}
                      title={Object.keys(option.colorScheme)[i]}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedId}
            className={`
              px-8 py-2.5 text-sm font-medium rounded-lg transition-all
              ${selectedId
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Use This Design
          </button>
        </div>
      </div>
    </div>
  );
}
