'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [typedText, setTypedText] = useState('')
  const [agentProgress, setAgentProgress] = useState([0, 0, 0])
  const [showConfetti, setShowConfetti] = useState(false)

  const fullText = "Build a dashboard with analytics"

  useEffect(() => {
    if (activeStep === 0 && !isTyping) {
      setIsTyping(true)
      setTypedText('')
      let i = 0
      const interval = setInterval(() => {
        if (i < fullText.length) {
          setTypedText(fullText.slice(0, i + 1))
          i++
        } else {
          clearInterval(interval)
        }
      }, 80)
      return () => clearInterval(interval)
    }
  }, [activeStep, isTyping])

  useEffect(() => {
    if (activeStep === 1) {
      const intervals = [0, 1, 2].map((idx) => {
        return setInterval(() => {
          setAgentProgress(prev => {
            const newProgress = [...prev]
            if (newProgress[idx] < 100) {
              newProgress[idx] = Math.min(100, newProgress[idx] + Math.random() * 15)
            }
            return newProgress
          })
        }, 200 + idx * 100)
      })
      return () => intervals.forEach(clearInterval)
    } else {
      setAgentProgress([0, 0, 0])
    }
  }, [activeStep])

  useEffect(() => {
    if (activeStep === 3) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
    }
  }, [activeStep])

  const steps = [
    {
      step: "01",
      title: "Create a Card",
      emoji: "✨",
      description: "Drop a mission onto the Kanban board. It can be as simple as \"Build a dashboard\" or as complex as a full SaaS application.",
      color: "from-purple-500 to-pink-500",
      visual: (
        <motion.div
          className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <motion.div
              className="w-3 h-3 rounded-full bg-red-500"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <motion.div
              className="w-3 h-3 rounded-full bg-yellow-500"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.2 }}
            />
            <motion.div
              className="w-3 h-3 rounded-full bg-green-500"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.4 }}
            />
          </div>
          <motion.div
            className="bg-white dark:bg-gray-900 rounded-lg p-4 border-2 border-dashed border-purple-300 dark:border-purple-500/50"
            animate={activeStep === 0 ? {
              borderColor: ['#a855f7', '#ec4899', '#a855f7'],
              boxShadow: ['0 0 0px #a855f7', '0 0 20px #a855f7', '0 0 0px #a855f7']
            } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div className="text-sm text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-2">
              <span>🎯</span> New Mission
            </div>
            <div className="text-gray-900 dark:text-white font-medium h-6">
              {activeStep === 0 ? typedText : fullText}
              {activeStep === 0 && typedText.length < fullText.length && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="inline-block w-0.5 h-5 bg-purple-500 ml-0.5"
                />
              )}
            </div>
            <motion.div
              className="flex gap-2 mt-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
            >
              <motion.span
                whileHover={{ scale: 1.1 }}
                className="text-xs px-2 py-1 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-400 rounded cursor-pointer"
              >
                React
              </motion.span>
              <motion.span
                whileHover={{ scale: 1.1 }}
                className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 rounded cursor-pointer"
              >
                TypeScript
              </motion.span>
              <motion.span
                whileHover={{ scale: 1.1 }}
                className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded cursor-pointer"
              >
                + Add tag
              </motion.span>
            </motion.div>
          </motion.div>
        </motion.div>
      )
    },
    {
      step: "02",
      title: "Agents Activate",
      emoji: "🤖",
      description: "Specialist agents automatically coordinate. Architect designs the system, Planner breaks it down, Coder implements, Tester validates.",
      color: "from-cyan-500 to-blue-500",
      visual: (
        <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            {[
              { name: "Architect", emoji: "🏗️", status: "Designing system...", color: "bg-purple-500", gradient: "from-purple-500 to-purple-600" },
              { name: "Planner", emoji: "📋", status: "Breaking down tasks...", color: "bg-cyan-500", gradient: "from-cyan-500 to-cyan-600" },
              { name: "Coder", emoji: "💻", status: "Writing components...", color: "bg-green-500", gradient: "from-green-500 to-green-600" }
            ].map((agent, i) => (
              <motion.div
                key={i}
                className="bg-white dark:bg-gray-900 rounded-lg p-3 overflow-hidden relative"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.2 }}
              >
                <motion.div
                  className={`absolute inset-0 bg-gradient-to-r ${agent.gradient} opacity-10`}
                  initial={{ width: '0%' }}
                  animate={{ width: activeStep === 1 ? `${agentProgress[i]}%` : '0%' }}
                  transition={{ duration: 0.3 }}
                />
                <div className="relative flex items-center gap-3">
                  <motion.span
                    className="text-xl"
                    animate={activeStep === 1 ? { rotate: [0, 10, -10, 0] } : {}}
                    transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                  >
                    {agent.emoji}
                  </motion.span>
                  <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">{agent.name}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-gray-500 text-xs">{agent.status}</span>
                    <motion.div
                      className={`w-2 h-2 rounded-full ${agent.color}`}
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    />
                  </div>
                </div>
                {activeStep === 1 && (
                  <div className="mt-2 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full bg-gradient-to-r ${agent.gradient}`}
                      initial={{ width: '0%' }}
                      animate={{ width: `${agentProgress[i]}%` }}
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          <motion.div
            className="mt-3 text-center text-xs text-gray-500"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            🔄 Agents syncing in real-time...
          </motion.div>
        </div>
      )
    },
    {
      step: "03",
      title: "Stay in Command",
      emoji: "🎮",
      description: "Review code in real-time, adjust requirements, or chat with the agents. You're the director — the agents do the heavy lifting.",
      color: "from-green-500 to-emerald-500",
      visual: (
        <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            <motion.div
              className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg p-3"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                >
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </motion.div>
                <span className="text-gray-900 dark:text-white text-sm font-medium">Code Ready</span>
                <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded-full">+847 lines</span>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-xs px-3 py-1 bg-green-600 text-white rounded-full font-medium"
                >
                  ✓ Approve
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                >
                  Review
                </motion.button>
              </div>
            </motion.div>
            <motion.div
              className="bg-white dark:bg-gray-900 rounded-lg p-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-start gap-2 text-sm">
                <span className="text-2xl">👤</span>
                <div className="flex-1">
                  <span className="text-cyan-600 dark:text-cyan-400 font-medium">You:</span>
                  <motion.span
                    className="text-gray-600 dark:text-gray-400 ml-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    Add dark mode support
                  </motion.span>
                </div>
              </div>
              <motion.div
                className="flex items-start gap-2 text-sm mt-2 pl-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <span className="text-purple-600 dark:text-purple-400 font-medium">🤖 Coder:</span>
                <span className="text-gray-600 dark:text-gray-400">On it! Adding theme toggle now...</span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      )
    },
    {
      step: "04",
      title: "Ship It",
      emoji: "🚀",
      description: "Working software lands in production. Preview your app in real-time, then deploy with one click.",
      color: "from-orange-500 to-red-500",
      visual: (
        <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 relative overflow-hidden">
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute text-2xl"
                  initial={{
                    top: '50%',
                    left: '50%',
                    scale: 0
                  }}
                  animate={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    scale: [0, 1, 0],
                    rotate: Math.random() * 360
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.05
                  }}
                >
                  {['🎉', '✨', '🎊', '⭐', '🔥'][i % 5]}
                </motion.div>
              ))}
            </div>
          )}
          <div className="text-center relative">
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-cyan-500 mb-3"
              animate={activeStep === 3 ? {
                scale: [1, 1.2, 1],
                boxShadow: ['0 0 0px #10b981', '0 0 30px #10b981', '0 0 0px #10b981']
              } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <motion.svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </motion.svg>
            </motion.div>
            <motion.div
              className="text-gray-900 dark:text-white font-bold text-xl mb-1"
              animate={activeStep === 3 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              🎉 App Complete!
            </motion.div>
            <div className="text-gray-500 dark:text-gray-400 text-sm mb-3">Deployed to production</div>
            <div className="flex justify-center gap-4 text-xs">
              {[
                { label: '23 components', icon: '📦' },
                { label: '8 pages', icon: '📄' },
                { label: '100% working', icon: '✅' }
              ].map((stat, i) => (
                <motion.span
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-900 rounded-full text-gray-600 dark:text-gray-400"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.2 }}
                  whileHover={{ scale: 1.1 }}
                >
                  <span>{stat.icon}</span>
                  <span>{stat.label}</span>
                </motion.span>
              ))}
            </div>
          </div>
        </div>
      )
    }
  ]

  return (
    <section className="py-24 md:py-32 px-4 md:px-8 bg-gradient-to-b from-gray-50 to-white dark:from-black dark:to-gray-950">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center px-4 py-2 mb-6 text-sm font-medium text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/30 rounded-full border border-cyan-300 dark:border-cyan-700/50">
            ✨ How It Works
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white tracking-tight">
            From Idea to Production
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            App development becomes visual. Cards are missions. Agents are your development team.
          </p>
        </motion.div>

        <div className="flex justify-center gap-2 mb-12">
          {steps.map((step, index) => (
            <motion.button
              key={index}
              onClick={() => {
                setActiveStep(index)
                setIsTyping(false)
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeStep === index
                ? `bg-gradient-to-r ${step.color} text-white shadow-lg`
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
            >
              <span className="mr-1">{step.emoji}</span>
              {step.step}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row items-center gap-8 md:gap-16"
          >
            <div className="flex-1">
              <motion.div
                className={`text-7xl font-bold bg-gradient-to-r ${steps[activeStep].color} bg-clip-text text-transparent mb-4`}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {steps[activeStep].step}
              </motion.div>
              <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                <span>{steps[activeStep].emoji}</span>
                {steps[activeStep].title}
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">{steps[activeStep].description}</p>

              <div className="flex gap-4 mt-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveStep(prev => (prev > 0 ? prev - 1 : steps.length - 1))}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  ← Previous
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveStep(prev => (prev < steps.length - 1 ? prev + 1 : 0))}
                  className={`px-4 py-2 bg-gradient-to-r ${steps[activeStep].color} text-white rounded-lg font-medium`}
                >
                  Next →
                </motion.button>
              </div>
            </div>
            <div className="flex-1 w-full max-w-md">
              {steps[activeStep].visual}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
