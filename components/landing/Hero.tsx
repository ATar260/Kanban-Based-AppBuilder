'use client'

import { motion } from 'framer-motion'

export default function Hero() {
  const handleGetAccess = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleWatchDemo = () => {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      id="hero"
      className="relative pt-44 pb-24 md:pt-56 md:pb-32 bg-gradient-to-b from-white to-comfort-sage-50/50 overflow-hidden"
    >
      {/* Main content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="inline-flex items-center px-3 py-1.5 mb-8 text-xs font-medium text-comfort-sage-700 bg-comfort-sage-100 rounded-full"
          >
            <span className="relative flex h-1.5 w-1.5 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-comfort-sage-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-comfort-sage-500"></span>
            </span>
            AI-Powered App Development
          </motion.div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 leading-tight tracking-tight text-comfort-charcoal-800">
            Build Apps with{' '}
            <span className="text-comfort-sage-600">Visual AI Agents</span>
          </h1>

          {/* Subheadline */}
          <p className="text-base md:text-lg max-w-xl mx-auto mb-10 text-comfort-charcoal-500">
            Create a card, watch AI agents build your vision in real-time.
          </p>

          {/* CTA Buttons - Inline */}
          <div className="flex gap-3 justify-center items-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGetAccess}
              className="px-6 py-2.5 bg-comfort-sage-500 hover:bg-comfort-sage-600 text-white font-medium rounded-xl transition-all shadow-md text-sm"
            >
              Get Early Access
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleWatchDemo}
              className="px-6 py-2.5 bg-white hover:bg-comfort-sage-50 text-comfort-charcoal-700 font-medium rounded-xl transition-all shadow-sm border border-comfort-sage-200 text-sm"
            >
              Watch Demo
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
