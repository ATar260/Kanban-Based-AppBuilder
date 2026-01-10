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
  Architect: "from-comfort-sage-500 to-comfort-sage-600",
  Planner: "from-comfort-sage-400 to-comfort-sage-500",
  Coder: "from-comfort-sage-600 to-comfort-sage-700",
  Tester: "from-comfort-terracotta-400 to-comfort-terracotta-500",
  DevOps: "from-comfort-sage-500 to-comfort-sage-600",
  Designer: "from-comfort-terracotta-300 to-comfort-terracotta-400",
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
      color: "from-comfort-sage-500 to-comfort-sage-600"
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
      color: "from-comfort-sage-400 to-comfort-sage-500"
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
      color: "from-comfort-sage-600 to-comfort-sage-700"
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
      color: "from-comfort-terracotta-400 to-comfort-terracotta-500"
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
      color: "from-comfort-sage-500 to-comfort-sage-600"
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
      color: "from-comfort-terracotta-300 to-comfort-terracotta-400"
    }
  ]

  return (
    <section id="agents" className="py-12 md:py-16 bg-comfort-sage-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-comfort-sage-100/40 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 text-sm font-medium text-comfort-sage-700 bg-comfort-sage-100 rounded-full border border-comfort-sage-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-comfort-sage-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-comfort-sage-500"></span>
            </span>
            6 Specialist AI Agents
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="group flex flex-col items-center gap-2 mx-auto"
          >
            <span className="flex items-center gap-2 text-3xl sm:text-4xl md:text-5xl font-bold text-comfort-charcoal-800 tracking-tight group-hover:text-comfort-sage-600 transition-colors">
              Your AI Development Team
              <motion.svg
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-comfort-sage-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </motion.svg>
            </span>
          </button>
          <p className="text-lg md:text-xl text-comfort-charcoal-500 max-w-3xl mx-auto mt-4">
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
                    className="group relative bg-white/80 border border-comfort-sage-200 rounded-2xl p-6 hover:border-comfort-sage-300 transition-all duration-300 hover:shadow-xl hover:shadow-comfort-sage-500/10"
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-comfort-sage-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    <div className="flex items-start justify-between mb-4">
                      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${agent.color} shadow-lg`}>
                        <div className="text-white">
                          {agent.icon}
                        </div>
                      </div>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: activeAgent === index ? 1 : 0 }}
                        className="flex items-center gap-1 px-2 py-1 bg-comfort-sage-100 rounded-full"
                      >
                        <span className="w-1.5 h-1.5 bg-comfort-sage-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-medium text-comfort-sage-700">Active</span>
                      </motion.div>
                    </div>

                    <div className="mb-1">
                      <span className="text-xs font-medium text-comfort-sage-600 uppercase tracking-wider">
                        {agent.role}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-comfort-charcoal-800 mb-2">
                      {agent.name}
                    </h3>
                    <p className="text-comfort-charcoal-500 leading-relaxed mb-4">
                      {agent.description}
                    </p>

                    <div className="pt-4 border-t border-comfort-sage-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-comfort-charcoal-400">{agent.stats}</span>
                        <motion.div
                          whileHover={{ x: 4 }}
                          className="text-comfort-sage-500"
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
          <div className="relative bg-gradient-to-r from-comfort-sage-50 via-comfort-sage-50/50 to-comfort-sage-50 border border-comfort-sage-200 rounded-2xl p-6 md:p-8 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-comfort-sage-500 to-transparent" />

            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex -space-x-3">
                {agents.map((agent, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${agent.color} border-3 border-white flex items-center justify-center shadow-lg`}
                  >
                    <div className="text-white scale-75">
                      {agent.icon}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex-1 text-center md:text-left">
                <h4 className="text-lg font-semibold text-comfort-charcoal-800 mb-1">
                  Real-time Collaboration
                </h4>
                <p className="text-comfort-charcoal-500 text-sm">
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
                    className="bg-white border border-comfort-sage-200 rounded-xl p-4 shadow-sm"
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
                          className="h-0.5 bg-gradient-to-r from-comfort-sage-500 to-comfort-sage-400 rounded-full"
                        />
                        <svg className="w-4 h-4 text-comfort-charcoal-400 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${agentColors[collaborationMessages[activeMessage].to]} flex items-center justify-center shadow-md`}>
                        <span className="text-base">{agentEmojis[collaborationMessages[activeMessage].to]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-comfort-charcoal-800">
                        {collaborationMessages[activeMessage].from}
                      </span>
                      <span className="text-xs text-comfort-charcoal-400">to</span>
                      <span className="text-xs font-semibold text-comfort-charcoal-800">
                        {collaborationMessages[activeMessage].to}
                      </span>
                    </div>
                    <p className="text-sm text-comfort-charcoal-500 italic">
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
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeMessage ? 'bg-comfort-sage-500' : 'bg-comfort-sage-300'
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
