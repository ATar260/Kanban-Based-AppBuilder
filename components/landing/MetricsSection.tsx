'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { InfiniteMovingCards } from '@/components/ui/infinite-moving-cards'

const testimonials = [
  {
    quote: "Built my entire SaaS in 2 days! The AI agents understand exactly what I need and the Kanban board makes it so easy to track progress.",
    name: "Sarah K.",
    title: "Founder, TechStart"
  },
  {
    quote: "The multi-agent system is incredible. It's like having a full dev team that never sleeps. We've 10x'd our shipping velocity.",
    name: "Mike R.",
    title: "CTO, ScaleUp Inc"
  },
  {
    quote: "Finally, a no-code platform that actually produces production-quality code. The real-time preview is a game changer.",
    name: "Lisa M.",
    title: "Product Manager"
  },
  {
    quote: "My team loves the visual workflow. We can see exactly what each agent is doing and intervene when needed.",
    name: "John D.",
    title: "Tech Lead"
  },
  {
    quote: "Shipped 5 new features this week alone. The automatic error fixing saves us hours of debugging time.",
    name: "Anna T.",
    title: "Solo Founder"
  },
  {
    quote: "The code quality is surprisingly good. Clean, well-documented, and follows best practices. Highly recommend!",
    name: "Chris P.",
    title: "Senior Developer"
  },
]

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
      color: "from-comfort-sage-500 to-comfort-sage-600",
      funFact: "From idea to deployment!"
    },
    {
      value: "24/7",
      label: "AI Assistance",
      description: "Agents work around the clock while you sleep",
      emoji: "🌙",
      color: "from-comfort-sage-400 to-comfort-sage-500",
      funFact: "Sleep tight, ship features!"
    },
    {
      value: "Full",
      label: "Stack Coverage",
      description: "Frontend, backend, database, deployment",
      emoji: "🎯",
      color: "from-comfort-sage-600 to-comfort-sage-700",
      funFact: "Everything in one place!"
    },
    {
      value: "Zero",
      label: "Coding Required",
      description: "Just describe what you want to build",
      emoji: "🧠",
      color: "from-comfort-terracotta-400 to-comfort-terracotta-500",
      funFact: "Your ideas become reality!"
    }
  ]

  return (
    <section id="metrics" className="py-12 md:py-16 bg-comfort-sage-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-comfort-charcoal-800 tracking-tight">
            Human Vision, AI Execution
          </h2>
          <p className="text-lg text-comfort-charcoal-500 max-w-2xl mx-auto">
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
              className="group relative bg-gradient-to-b from-comfort-sage-50 to-white border border-comfort-sage-200 rounded-2xl p-8 text-center hover:border-comfort-sage-300 transition-all duration-300 cursor-pointer overflow-hidden"
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

              <div className="text-xl font-semibold text-comfort-charcoal-800 mb-2">
                {metric.label}
              </div>

              <p className="text-comfort-charcoal-500 text-sm mb-2">
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
          className="mt-16 bg-gradient-to-r from-comfort-sage-50 to-comfort-sage-100 border border-comfort-sage-200 rounded-2xl p-8 md:p-12 overflow-hidden"
        >
          <h3 className="text-2xl md:text-3xl font-bold text-comfort-charcoal-800 mb-10 text-center">
            The Complete App Building Platform
          </h3>

          <div className="flex flex-col items-center gap-10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 md:gap-14">
              {tools.map((tool, index) => (
                <motion.div
                  key={tool.name}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + index * 0.1, type: 'spring', stiffness: 200 }}
                  whileHover={{ scale: 1.05, y: -4 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl flex items-center justify-center bg-white border border-comfort-sage-200 shadow-sm hover:shadow-md hover:border-comfort-sage-300 transition-all">
                    <span className="text-2xl md:text-3xl">{tool.emoji}</span>
                  </div>
                  <span className="text-sm font-medium text-comfort-charcoal-600">{tool.name}</span>
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
                  ? 'bg-gradient-to-br from-comfort-sage-500 to-comfort-sage-600 border-transparent shadow-lg shadow-comfort-sage-500/30'
                  : 'bg-white border-dashed border-comfort-sage-300 hover:border-comfort-sage-400'
                  }`}
              >
                <motion.span
                  className="text-4xl md:text-5xl"
                  animate={fusionComplete ? { rotate: 360 } : {}}
                  transition={{ duration: 0.5 }}
                >
                  {fusionComplete ? '⚡' : '🔮'}
                </motion.span>
                <span className={`text-xs font-bold ${fusionComplete ? 'text-white' : 'text-comfort-charcoal-500'}`}>
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
                      className="bg-white rounded-xl p-4 text-center border border-comfort-sage-200 hover:border-comfort-sage-300 transition-colors cursor-default"
                    >
                      <span className="text-2xl mb-2 block">{feature.icon}</span>
                      <p className="text-xs font-semibold text-comfort-charcoal-800 mb-1">{feature.name}</p>
                      <p className="text-[10px] text-comfort-charcoal-500">{feature.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Testimonials with infinite scroll */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-16"
        >
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold text-comfort-charcoal-800 mb-2">
              Trusted by Builders Everywhere
            </h3>
            <p className="text-sm text-comfort-charcoal-500">
              Join thousands of developers shipping faster with AI
            </p>
          </div>
          <InfiniteMovingCards
            items={testimonials}
            direction="left"
            speed="slow"
            pauseOnHover={true}
          />
        </motion.div>

      </div>
    </section>
  )
}

