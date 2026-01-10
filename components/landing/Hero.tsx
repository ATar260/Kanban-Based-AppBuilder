'use client'

import { motion } from 'framer-motion'
import { Spotlight } from '@/components/ui/spotlight'
import { TextGenerateEffect } from '@/components/ui/text-generate-effect'

export default function Hero() {
  const handleGetAccess = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleWatchDemo = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      id="hero"
      className="relative pt-32 pb-20 md:pt-36 md:pb-28 bg-gradient-to-br from-comfort-sage-50 via-white to-comfort-sage-100/30 overflow-hidden"
    >
      {/* Spotlight effect */}
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="rgba(127, 181, 137, 0.15)"
      />

      {/* Aurora gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-comfort-sage-100/20 via-white/10 to-comfort-sage-200/20 animate-aurora opacity-50" />

      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Main content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="inline-flex items-center px-4 py-2 mb-8 text-sm font-medium text-comfort-sage-700 bg-comfort-sage-100/80 backdrop-blur-sm rounded-full border border-comfort-sage-200/50"
          >
            <span className="relative flex h-2 w-2 mr-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-comfort-sage-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-comfort-sage-500"></span>
            </span>
            AI-Powered App Development
          </motion.div>

          {/* Headline with text generate effect */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] tracking-tight">
            <TextGenerateEffect
              words="Build Apps with"
              className="text-comfort-charcoal-800 inline"
              duration={0.5}
              staggerDelay={0.08}
            />
            <br />
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="bg-gradient-to-r from-comfort-sage-600 via-comfort-sage-500 to-comfort-sage-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-aurora"
            >
              Visual AI Agents
            </motion.span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl md:text-2xl max-w-2xl mx-auto mb-10 text-comfort-charcoal-500 leading-relaxed">
            Don&apos;t write code &mdash; <span className="text-comfort-charcoal-700 font-medium">direct it</span>.
            Create a card, watch AI agents build your vision in real-time.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-14">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGetAccess}
              className="w-full sm:w-auto px-8 py-4 bg-comfort-sage-500 hover:bg-comfort-sage-600 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-comfort-sage-500/20 hover:shadow-xl hover:shadow-comfort-sage-500/25"
            >
              Get Early Access
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleWatchDemo}
              className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-comfort-sage-50 text-comfort-charcoal-700 font-semibold rounded-2xl transition-all shadow-md border border-comfort-sage-200 hover:border-comfort-sage-300"
            >
              See How It Works
            </motion.button>
          </div>

          {/* Feature highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="flex flex-wrap justify-center gap-6 text-sm text-comfort-charcoal-500"
          >
            {[
              { icon: '🚀', text: 'Ship in hours, not weeks' },
              { icon: '🤖', text: '6 specialist AI agents' },
              { icon: '📋', text: 'Visual Kanban workflow' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-xl border border-comfort-sage-200/50"
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.text}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
