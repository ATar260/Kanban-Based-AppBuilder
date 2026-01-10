'use client'

import { motion } from 'framer-motion'

export default function BackedBySection() {
  return (
    <section className="py-8 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-4 px-8 py-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-300">
            <span className="text-sm font-medium text-gray-500">Backed by</span>
            <motion.div
              className="flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <span className="text-white font-bold text-lg">CX</span>
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900 text-lg">ConceptionX</div>
                <div className="text-xs text-gray-500">Venture Builder</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
