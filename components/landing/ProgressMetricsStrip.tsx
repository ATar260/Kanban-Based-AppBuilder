'use client'

import { motion } from 'framer-motion'

const metrics = [
  { value: '10x', label: 'Faster Development', icon: '🚀' },
  { value: '24/7', label: 'AI Assistance', icon: '🌙' },
  { value: '6', label: 'Specialist Agents', icon: '🤖' },
  { value: '0', label: 'Code Required', icon: '✨' },
]

export default function ProgressMetricsStrip() {
  return (
    <section className="py-8 md:py-12 bg-white border-y border-comfort-sage-200">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {metrics.map((metric, i) => (
            <motion.div
              key={i}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
            >
              <span className="text-2xl mb-2 block">{metric.icon}</span>
              <div className="text-3xl md:text-4xl font-bold text-comfort-sage-600 mb-1">
                {metric.value}
              </div>
              <div className="text-sm text-comfort-charcoal-500">{metric.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
