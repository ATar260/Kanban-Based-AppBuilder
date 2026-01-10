'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

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

interface ViewPaneUISelectorProps {
  options: UIOption[];
  onSelect: (option: UIOption) => void;
  onCancel: () => void;
  isLoading?: boolean;
  prompt?: string;
}

export default function ViewPaneUISelector({
  options,
  onSelect,
  onCancel,
  isLoading = false,
  prompt = '',
}: ViewPaneUISelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-3xl"
        >
          {/* Animated orbs */}
          <div className="relative w-40 h-40 mx-auto mb-10">
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.2, 0.5, 0.2],
                rotate: [0, 180, 360]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-full blur-3xl"
            />
            <motion.div
              animate={{
                scale: [1.3, 1, 1.3],
                opacity: [0.2, 0.5, 0.2],
                rotate: [360, 180, 0]
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-3xl"
            />
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-400 rounded-full blur-3xl"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Crafting Your Design Options
          </h2>
          <p className="text-lg text-gray-500 mb-8">
            Our AI is generating 3 unique, creative approaches for your app...
          </p>

          {/* Loading placeholders */}
          <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                className="aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl animate-pulse shadow-lg"
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 via-white to-emerald-50/20 overflow-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10"
      >
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center px-4 py-2 mb-4 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-full border border-emerald-200"
          >
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
            3 Creative Options Ready
          </motion.div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Choose Your Design Direction
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Each option represents a unique visual identity for your application. Click to select.
          </p>
          {prompt && (
            <p className="mt-4 text-sm text-gray-400 italic truncate max-w-xl mx-auto bg-gray-50 px-4 py-2 rounded-full">
              Building: &quot;{prompt}&quot;
            </p>
          )}
        </div>
      </motion.div>

      {/* Options Grid - 3 large cards */}
      <div className="flex-1 p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {options.slice(0, 3).map((option, index) => (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.1, type: 'spring', stiffness: 150 }}
              onMouseEnter={() => setHoveredId(option.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelect(option)}
              className={`
                relative rounded-3xl cursor-pointer transition-all duration-500 overflow-hidden
                bg-white border-2 shadow-xl group
                ${hoveredId === option.id
                  ? 'border-emerald-500 shadow-2xl shadow-emerald-500/20 scale-[1.02] -translate-y-2'
                  : 'border-gray-200 hover:border-emerald-300'
                }
              `}
            >
              {/* Option badge */}
              <div className="absolute top-5 left-5 z-10">
                <motion.span
                  className="px-4 py-1.5 bg-white/95 backdrop-blur-sm rounded-full text-sm font-bold text-gray-700 shadow-lg border border-gray-100"
                  animate={hoveredId === option.id ? { scale: 1.05 } : { scale: 1 }}
                >
                  Option {index + 1}
                </motion.span>
              </div>

              {/* Style badge */}
              <div className="absolute top-5 right-5 z-10">
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: option.colorScheme.primary + '20',
                    color: option.colorScheme.primary
                  }}
                >
                  {option.style}
                </span>
              </div>

              {/* Large color preview header */}
              <div
                className="aspect-[16/10] relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${option.colorScheme.primary}, ${option.colorScheme.secondary}, ${option.colorScheme.accent})` }}
              >
                {/* Mock UI preview - more detailed */}
                <div className="absolute inset-6 flex items-center justify-center">
                  <motion.div
                    className="w-full h-full rounded-2xl shadow-2xl overflow-hidden"
                    style={{ backgroundColor: option.colorScheme.background }}
                    animate={hoveredId === option.id ? { y: -8, scale: 1.02 } : { y: 0, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Mock header bar */}
                    <div
                      className="h-10 flex items-center px-4 gap-2"
                      style={{ backgroundColor: option.colorScheme.primary + '10' }}
                    >
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                      </div>
                      <div
                        className="h-2 w-24 rounded ml-4"
                        style={{ backgroundColor: option.colorScheme.text + '20' }}
                      />
                    </div>

                    <div className="p-5 h-full flex flex-col">
                      {/* Mock navigation */}
                      <div className="flex gap-3 mb-4">
                        {[1, 2, 3, 4].map((n) => (
                          <div
                            key={n}
                            className="h-2 w-12 rounded"
                            style={{ backgroundColor: option.colorScheme.text + '15' }}
                          />
                        ))}
                      </div>

                      {/* Mock hero */}
                      <div
                        className="h-4 w-2/3 rounded mb-3"
                        style={{ backgroundColor: option.colorScheme.primary }}
                      />
                      <div
                        className="h-2 w-4/5 rounded mb-2"
                        style={{ backgroundColor: option.colorScheme.text + '25' }}
                      />
                      <div
                        className="h-2 w-3/5 rounded mb-5"
                        style={{ backgroundColor: option.colorScheme.text + '15' }}
                      />

                      {/* Mock buttons */}
                      <div className="flex gap-3">
                        <div
                          className="h-8 w-24 rounded-lg"
                          style={{ backgroundColor: option.colorScheme.accent }}
                        />
                        <div
                          className="h-8 w-20 rounded-lg border-2"
                          style={{ borderColor: option.colorScheme.primary + '40' }}
                        />
                      </div>

                      {/* Mock cards */}
                      <div className="flex gap-3 mt-auto">
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className="flex-1 h-16 rounded-lg"
                            style={{ backgroundColor: option.colorScheme.secondary + '15' }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Hover overlay with CTA */}
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={hoveredId === option.id ? { opacity: 1 } : { opacity: 0 }}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={hoveredId === option.id ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
                    className="px-8 py-4 bg-white rounded-2xl font-bold text-gray-900 shadow-2xl flex items-center gap-3"
                  >
                    <span>Select This Design</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </motion.div>
                </motion.div>
              </div>

              {/* Content section - more detailed */}
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{option.name}</h3>
                <p className="text-gray-500 mb-5 leading-relaxed line-clamp-3">{option.description}</p>

                {/* Layout info */}
                <div className="mb-5 p-3 bg-gray-50 rounded-xl">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Layout</span>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{option.layout}</p>
                </div>

                {/* Features */}
                <div className="mb-5">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">Features</span>
                  <div className="flex flex-wrap gap-2">
                    {option.features.slice(0, 5).map((feature, i) => (
                      <span
                        key={i}
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition-transform hover:scale-105"
                        style={{
                          backgroundColor: option.colorScheme.primary + '12',
                          color: option.colorScheme.primary
                        }}
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Color palette - larger */}
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 block">Color Palette</span>
                  <div className="flex items-center gap-3">
                    {Object.entries(option.colorScheme).map(([name, color], i) => (
                      <div key={i} className="group/color relative">
                        <div
                          className="w-10 h-10 rounded-xl border-2 border-white shadow-md transition-transform hover:scale-110 hover:-translate-y-1"
                          style={{ backgroundColor: color }}
                        />
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 capitalize opacity-0 group-hover/color:opacity-100 transition-opacity whitespace-nowrap">
                          {name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer with cancel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-6 border-t border-gray-100 bg-white/80 backdrop-blur-sm"
      >
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <p className="text-sm text-gray-400">
            Click any design to start building with that style
          </p>
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
          >
            Cancel and Start Over
          </button>
        </div>
      </motion.div>
    </div>
  );
}
