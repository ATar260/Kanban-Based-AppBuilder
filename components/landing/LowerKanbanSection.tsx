'use client'

import { motion } from 'framer-motion'

const agents = [
  { id: 'architect', emoji: '🏗️', color: '#7B5EA7' },
  { id: 'planner', emoji: '📋', color: '#5E9A68' },
  { id: 'coder', emoji: '💻', color: '#6BA875' },
  { id: 'tester', emoji: '🧪', color: '#E07B54' },
  { id: 'devops', emoji: '🚀', color: '#4D8957' },
  { id: 'designer', emoji: '🎨', color: '#D4699A' },
]

const additionalTasks = [
  { id: 'TSK-019', title: 'Mobile responsive layout', agent: 'designer' },
  { id: 'TSK-020', title: 'WebSocket integration', agent: 'coder' },
  { id: 'TSK-021', title: 'Redis caching layer', agent: 'architect' },
  { id: 'TSK-022', title: 'Load testing setup', agent: 'tester' },
  { id: 'TSK-023', title: 'Docker compose config', agent: 'devops' },
  { id: 'TSK-024', title: 'Color system tokens', agent: 'designer' },
]

function MiniCard({ task }: { task: typeof additionalTasks[0] }) {
  const agent = agents.find(a => a.id === task.agent)

  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="bg-white rounded-lg px-2.5 py-1.5 border border-comfort-sage-200/80 shadow-sm"
      style={{ aspectRatio: '3 / 1', minHeight: '44px' }}
    >
      <div className="flex items-center justify-between h-full gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-[10px] font-medium text-comfort-charcoal-600 truncate">
            {task.title}
          </h4>
          <span className="text-[8px] text-comfort-charcoal-400 font-mono">{task.id}</span>
        </div>
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]"
          style={{ backgroundColor: `${agent?.color}20` }}
        >
          {agent?.emoji}
        </div>
      </div>
    </motion.div>
  )
}

export default function LowerKanbanSection() {
  return (
    <section className="py-8 md:py-10 bg-comfort-sage-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-6"
        >
          <h3 className="text-lg font-semibold text-comfort-charcoal-700 mb-1">
            Complete Visibility Into Every Task
          </h3>
          <p className="text-sm text-comfort-charcoal-500">
            Track progress across your entire project lifecycle
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.7 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3"
        >
          {additionalTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <MiniCard task={task} />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Gradient fade at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-comfort-sage-50 to-transparent pointer-events-none" />
    </section>
  )
}
