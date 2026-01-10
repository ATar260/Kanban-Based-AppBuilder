'use client'

import { motion } from 'framer-motion'

export default function BuiltBySection() {
  const organizations = [
    { name: 'Microsoft', emoji: '🪟' },
    { name: 'Stripe', emoji: '💳' },
    { name: 'Vercel', emoji: '▲' },
    { name: 'Shopify', emoji: '🛒' },
    { name: 'Notion', emoji: '📝' },
    { name: 'Linear', emoji: '📊' },
    { name: 'Figma', emoji: '🎨' },
    { name: 'Slack', emoji: '💬' },
  ]

  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Trusted by innovative teams worldwide
          </p>
        </motion.div>

        <div className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          <motion.div
            animate={{
              x: ['0%', '-50%']
            }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: 20,
                ease: "linear",
              },
            }}
            className="flex gap-12 py-4"
          >
            {[...organizations, ...organizations].map((org, i) => (
              <motion.div
                key={`${org.name}-${i}`}
                className="flex items-center gap-3 flex-shrink-0 px-6 py-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-colors"
                whileHover={{ scale: 1.05, y: -2 }}
              >
                <span className="text-2xl">{org.emoji}</span>
                <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                  {org.name}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-gray-500"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>1000+ Apps Built</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>50+ Countries</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>99.9% Uptime</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
