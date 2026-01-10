'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

const agentEmojis: Record<string, string> = {
  Architect: "🏗️",
  Planner: "📋",
  Coder: "💻",
  Tester: "🧪",
  DevOps: "🚀",
  Designer: "🎨",
}

const agentColors: Record<string, string> = {
  Architect: "from-emerald-600 to-emerald-700",
  Planner: "from-emerald-500 to-emerald-600",
  Coder: "from-emerald-700 to-emerald-800",
  Tester: "from-emerald-400 to-emerald-500",
  DevOps: "from-emerald-600 to-emerald-700",
  Designer: "from-emerald-500 to-emerald-600",
}

const collaborationMessages = [
  { from: "Architect", to: "Coder", message: "Schema finalized, ready for implementation" },
  { from: "Coder", to: "Tester", message: "Auth module complete, needs test coverage" },
  { from: "Tester", to: "DevOps", message: "All 47 tests passing, clear to deploy" },
  { from: "DevOps", to: "Designer", message: "v2.3.1 live in production" },
  { from: "Planner", to: "Architect", message: "New feature request: payment integration" },
  { from: "Designer", to: "Planner", message: "UI specs synced, ready for review" },
]

export default function AgentTypesSection() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeMessage, setActiveMessage] = useState(0)
  const [activeAgent, setActiveAgent] = useState<number | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMessage((prev) => (prev + 1) % collaborationMessages.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const agents = [
    {
      name: "Architect Agent",
      role: "The Visionary",
      description: "Designs system architecture, defines data models, and plans technical infrastructure",
      stats: "2.3k systems designed",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: "from-purple-500 to-purple-600",
      bgGlow: "purple"
    },
    {
      name: "Planner Agent",
      role: "The Strategist",
      description: "Breaks complex tasks into executable subtasks and manages dependencies",
      stats: "15k tasks orchestrated",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      color: "from-cyan-500 to-cyan-600",
      bgGlow: "cyan"
    },
    {
      name: "Coder Agent",
      role: "The Builder",
      description: "Writes production-quality code, refactors existing implementations, and handles merges",
      stats: "1.2M lines shipped",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      color: "from-green-500 to-emerald-600",
      bgGlow: "green"
    },
    {
      name: "Tester Agent",
      role: "The Guardian",
      description: "Creates comprehensive test suites, runs tests, and automatically fixes failures",
      stats: "99.7% bug catch rate",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "from-yellow-500 to-orange-500",
      bgGlow: "orange"
    },
    {
      name: "DevOps Agent",
      role: "The Deployer",
      description: "Manages CI/CD pipelines, handles deployments, and monitors infrastructure",
      stats: "Zero-downtime deploys",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      color: "from-blue-500 to-blue-600",
      bgGlow: "blue"
    },
    {
      name: "Designer Agent",
      role: "The Artist",
      description: "Creates UI/UX designs, generates responsive layouts, and ensures visual consistency",
      stats: "Pixel-perfect output",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
      color: "from-pink-500 to-rose-600",
      bgGlow: "pink"
    }
  ]

  return (
    <section className="py-24 md:py-32 px-4 md:px-8 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-100/40 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-6 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-full border border-emerald-300"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
            6 Specialist AI Agents
          </motion.div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="group flex flex-col items-center gap-3 mx-auto"
          >
            <span className="flex items-center gap-3 text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 tracking-tight group-hover:text-emerald-700 transition-colors">
              Your AI Development Team
              <motion.svg
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </motion.svg>
            </span>
          </button>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mt-6">
            Each agent is a specialist. Together, they&apos;re a full engineering department that never sleeps.
          </p>
        </motion.div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
                {agents.map((agent, index) => (
                  <motion.div
                    key={agent.name}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1, duration: 0.6 }}
                    whileHover={{ y: -8, transition: { duration: 0.2 } }}
                    onHoverStart={() => setActiveAgent(index)}
                    onHoverEnd={() => setActiveAgent(null)}
                    className="group relative bg-gray-50 border border-gray-200 rounded-2xl p-6 hover:border-emerald-300 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10"
                  >
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-${agent.bgGlow}-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />

                    <div className="flex items-start justify-between mb-4">
                      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${agent.color} shadow-lg`}>
                        <div className="text-white">
                          {agent.icon}
                        </div>
                      </div>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: activeAgent === index ? 1 : 0 }}
                        className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-500/20 rounded-full"
                      >
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-medium text-green-700 dark:text-green-400">Active</span>
                      </motion.div>
                    </div>

                    <div className="mb-1">
                      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                        {agent.role}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {agent.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                      {agent.description}
                    </p>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-500">{agent.stats}</span>
                        <motion.div
                          whileHover={{ x: 4 }}
                          className="text-purple-500 dark:text-purple-400"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-16"
        >
          <div className="relative bg-gradient-to-r from-gray-50 via-purple-50/50 to-gray-50 dark:from-gray-900/50 dark:via-purple-900/20 dark:to-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex -space-x-3">
                {agents.map((agent, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${agent.color} border-3 border-white dark:border-gray-900 flex items-center justify-center shadow-lg`}
                  >
                    <div className="text-white scale-75">
                      {agent.icon}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex-1 text-center md:text-left">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Real-time Collaboration
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Watch your agents communicate, hand off tasks, and solve problems together
                </p>
              </div>

              <div className="w-full md:w-auto min-w-[320px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeMessage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${agentColors[collaborationMessages[activeMessage].from]} flex items-center justify-center shadow-md`}>
                        <span className="text-base">{agentEmojis[collaborationMessages[activeMessage].from]}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: 32 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                          className="h-0.5 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"
                        />
                        <svg className="w-4 h-4 text-gray-400 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${agentColors[collaborationMessages[activeMessage].to]} flex items-center justify-center shadow-md`}>
                        <span className="text-base">{agentEmojis[collaborationMessages[activeMessage].to]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">
                        {collaborationMessages[activeMessage].from}
                      </span>
                      <span className="text-xs text-gray-400">to</span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">
                        {collaborationMessages[activeMessage].to}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                      &quot;{collaborationMessages[activeMessage].message}&quot;
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex justify-center gap-1.5 mt-4 md:hidden">
              {collaborationMessages.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeMessage ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
