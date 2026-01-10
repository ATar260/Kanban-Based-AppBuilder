'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

const tools = [
  { name: 'React', emoji: '⚛️', color: '#61DAFB', feature: 'Frontend Framework' },
  { name: 'Next.js', emoji: '▲', color: '#000', feature: 'Full-Stack Framework' },
  { name: 'AI Models', emoji: '🤖', color: '#6e40c9', feature: 'Code Generation' },
  { name: 'Vercel', emoji: '🚀', color: '#000', feature: 'Deployment' },
]

const features = [
  { icon: '🎯', name: 'Multi-agent orchestration', desc: 'Coordinate AI agents seamlessly' },
  { icon: '👀', name: 'Real-time preview', desc: 'See your app as it builds' },
  { icon: '🚀', name: 'One-click deploy', desc: 'Ship to production instantly' },
  { icon: '✅', name: 'Auto error fixing', desc: 'AI fixes issues automatically' },
  { icon: '📊', name: 'Visual Kanban', desc: 'Track progress visually' },
]

export default function MetricsSection() {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null)
  const [fusionComplete, setFusionComplete] = useState(false)
  const [hoveredMetric, setHoveredMetric] = useState<number | null>(null)

  const metrics = [
    {
      value: "10x",
      label: "Faster Development",
      description: "Build apps in hours, not weeks",
      emoji: "🚀",
      color: "from-orange-500 to-red-500",
      funFact: "From idea to deployment!"
    },
    {
      value: "24/7",
      label: "AI Assistance",
      description: "Agents work around the clock while you sleep",
      emoji: "🌙",
      color: "from-blue-500 to-indigo-500",
      funFact: "Sleep tight, ship features!"
    },
    {
      value: "Full",
      label: "Stack Coverage",
      description: "Frontend, backend, database, deployment",
      emoji: "🎯",
      color: "from-green-500 to-emerald-500",
      funFact: "Everything in one place!"
    },
    {
      value: "Zero",
      label: "Coding Required",
      description: "Just describe what you want to build",
      emoji: "🧠",
      color: "from-purple-500 to-pink-500",
      funFact: "Your ideas become reality!"
    }
  ]

  return (
    <section className="py-24 md:py-32 px-4 md:px-8 bg-white dark:bg-black">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white tracking-tight">
            Human Vision, AI Execution
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            You direct the vision &mdash; AI handles the implementation.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 30, rotateX: -15 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.6, type: 'spring' }}
              whileHover={{
                scale: 1.05,
                y: -8,
                transition: { duration: 0.2 }
              }}
              onHoverStart={() => setHoveredMetric(index)}
              onHoverEnd={() => setHoveredMetric(null)}
              className="group relative bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <motion.div
                className={`absolute inset-0 bg-gradient-to-br ${metric.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
              />

              <motion.span
                className="text-4xl block mb-3"
                animate={hoveredMetric === index ? {
                  scale: [1, 1.3, 1],
                  rotate: [0, -10, 10, 0]
                } : {}}
                transition={{ duration: 0.5 }}
              >
                {metric.emoji}
              </motion.span>

              <motion.div
                className={`text-5xl md:text-6xl font-bold bg-gradient-to-r ${metric.color} bg-clip-text text-transparent mb-3`}
                animate={hoveredMetric === index ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {metric.value}
              </motion.div>

              <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {metric.label}
              </div>

              <p className="text-gray-500 text-sm mb-2">
                {metric.description}
              </p>

              <motion.p
                className={`text-xs font-medium bg-gradient-to-r ${metric.color} bg-clip-text text-transparent`}
                initial={{ opacity: 0, height: 0 }}
                animate={hoveredMetric === index ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
              >
                {metric.funFact}
              </motion.p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-16 bg-gradient-to-r from-purple-100 to-cyan-100 dark:from-purple-900/20 dark:to-cyan-900/20 border border-purple-200 dark:border-gray-800 rounded-2xl p-8 md:p-12 overflow-hidden"
        >
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            The Complete App Building Platform
          </h3>

          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-wrap justify-center items-center gap-4">
              {tools.map((tool, index) => (
                <motion.div
                  key={tool.name}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + index * 0.1, type: 'spring', stiffness: 200 }}
                  whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                  onHoverStart={() => setHoveredTool(tool.name)}
                  onHoverEnd={() => setHoveredTool(null)}
                  className="relative cursor-pointer"
                >
                  <div
                    className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-all duration-300 bg-white dark:bg-gray-900"
                    style={{
                      borderColor: hoveredTool === tool.name ? tool.color : '#e5e7eb'
                    }}
                  >
                    <span className="text-3xl md:text-4xl">{tool.emoji}</span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{tool.name}</span>
                  </div>
                  {hoveredTool === tool.name && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400"
                    >
                      {tool.feature}
                    </motion.div>
                  )}
                  {index < tools.length - 1 && (
                    <span className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">+</span>
                  )}
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1, type: 'spring', stiffness: 200 }}
                className="hidden md:flex items-center mx-4"
              >
                <span className="text-3xl">=</span>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1.1, type: 'spring', stiffness: 200 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFusionComplete(!fusionComplete)}
                className={`w-28 h-28 md:w-32 md:h-32 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all duration-500 ${fusionComplete
                  ? 'bg-gradient-to-br from-cyan-500 to-purple-600 border-transparent shadow-lg shadow-purple-500/30'
                  : 'bg-white dark:bg-gray-900 border-dashed border-gray-300 dark:border-gray-700 hover:border-purple-400'
                  }`}
              >
                <motion.span
                  className="text-4xl md:text-5xl"
                  animate={fusionComplete ? { rotate: 360 } : {}}
                  transition={{ duration: 0.5 }}
                >
                  {fusionComplete ? '⚡' : '🔮'}
                </motion.span>
                <span className={`text-xs font-bold ${fusionComplete ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                  {fusionComplete ? 'Paynto.AI' : 'Click to fuse!'}
                </span>
              </motion.button>
            </div>

            {fusionComplete && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="w-full"
              >
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                  {features.map((feature, index) => (
                    <motion.div
                      key={feature.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ y: -4 }}
                      className="bg-white dark:bg-gray-900/50 rounded-xl p-4 text-center border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 transition-colors cursor-default"
                    >
                      <span className="text-2xl mb-2 block">{feature.icon}</span>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white mb-1">{feature.name}</p>
                      <p className="text-[10px] text-gray-500">{feature.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
