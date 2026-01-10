'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

const agents = [
  { id: 'architect', name: 'Architect', emoji: '🏗️', color: '#047857' },
  { id: 'coder', name: 'Coder', emoji: '💻', color: '#059669' },
  { id: 'designer', name: 'Designer', emoji: '🎨', color: '#10B981' },
  { id: 'planner', name: 'Planner', emoji: '📋', color: '#065F46' },
  { id: 'tester', name: 'Tester', emoji: '🧪', color: '#047857' },
  { id: 'devops', name: 'DevOps', emoji: '🚀', color: '#064E3B' },
]

const columns = [
  { id: 'todo', name: 'To Do', color: '#065F46', emoji: '📝', description: 'Waiting to start' },
  { id: 'inprogress', name: 'In Progress', color: '#047857', emoji: '🔄', description: 'Agents working' },
  { id: 'review', name: 'Review', color: '#059669', emoji: '👀', description: 'Ready for review' },
  { id: 'done', name: 'Done', color: '#10B981', emoji: '✅', description: 'Completed' },
]

const tasks = [
  { id: 'TSK-001', title: 'Design dashboard layout', column: 'todo', priority: 'high', agent: 'designer', progress: 0 },
  { id: 'TSK-002', title: 'Create auth system', column: 'todo', priority: 'high', agent: 'architect', progress: 0 },
  { id: 'TSK-003', title: 'Build navigation', column: 'inprogress', priority: 'medium', agent: 'coder', progress: 65 },
  { id: 'TSK-004', title: 'API integration', column: 'inprogress', priority: 'high', agent: 'coder', progress: 40 },
  { id: 'TSK-005', title: 'Unit tests', column: 'inprogress', priority: 'medium', agent: 'tester', progress: 80 },
  { id: 'TSK-006', title: 'User profile page', column: 'review', priority: 'medium', agent: 'designer', progress: 100 },
  { id: 'TSK-007', title: 'Settings page', column: 'done', priority: 'low', agent: 'coder', progress: 100 },
  { id: 'TSK-008', title: 'Database setup', column: 'done', priority: 'high', agent: 'devops', progress: 100 },
]

const activityFeed = [
  { time: '2s ago', agent: 'coder', action: 'Committed', detail: 'Navigation.tsx' },
  { time: '5s ago', agent: 'architect', action: 'Approved', detail: 'API schema' },
  { time: '12s ago', agent: 'designer', action: 'Created', detail: 'ProfileCard.tsx' },
  { time: '18s ago', agent: 'tester', action: 'Passed', detail: 'Auth tests' },
  { time: '30s ago', agent: 'devops', action: 'Deployed', detail: 'Preview build' },
]

function AgentBadge({ agentId, showPulse = false }: { agentId: string, showPulse?: boolean }) {
  const agent = agents.find(a => a.id === agentId)
  if (!agent) return null

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full text-xs px-1.5 py-0.5"
      style={{ backgroundColor: `${agent.color}15`, color: agent.color }}
    >
      <span>{agent.emoji}</span>
      <span className="font-medium">{agent.name}</span>
      {showPulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: agent.color }}></span>
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: agent.color }}></span>
        </span>
      )}
    </span>
  )
}

function TaskCard({ task, isActive = false }: { task: typeof tasks[0], isActive?: boolean }) {
  const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)' }}
      className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        <span className="text-[10px] text-gray-400 font-mono">{task.id}</span>
      </div>
      <h4 className="text-sm font-medium text-gray-900 mb-2">{task.title}</h4>

      {task.progress > 0 && task.progress < 100 && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${task.progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <AgentBadge agentId={task.agent} showPulse={isActive} />
      </div>
    </motion.div>
  )
}

function Column({ column, columnTasks }: { column: typeof columns[0], columnTasks: typeof tasks }) {
  return (
    <div className="flex-shrink-0 w-[200px]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{column.emoji}</span>
        <div>
          <h3 className="text-xs font-semibold text-gray-900">{column.name}</h3>
          <p className="text-[9px] text-gray-500">{column.description}</p>
        </div>
        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full ml-auto">
          {columnTasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {columnTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            isActive={column.id === 'inprogress'}
          />
        ))}
      </div>
    </div>
  )
}

export default function MockUI() {
  const sectionRef = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  })

  const rotateX = useTransform(scrollYProgress, [0, 0.3, 0.5], [-90, -30, 0])
  const y = useTransform(scrollYProgress, [0, 0.3, 0.5], [50, 20, 0])
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.4], [0, 0.8, 1])
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.5], [0.9, 0.95, 1])

  const completedTasks = tasks.filter(t => t.column === 'done').length
  const totalTasks = tasks.length
  const progress = Math.round((completedTasks / totalTasks) * 100)

  return (
    <section ref={sectionRef} id="demo" className="py-24 md:py-32 px-4 md:px-8 bg-gray-50 overflow-hidden" style={{ perspective: '1000px', perspectiveOrigin: 'center bottom' }}>
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center px-4 py-2 mb-6 text-sm font-medium text-emerald-800 bg-emerald-100 rounded-full border border-emerald-300">
            Live Preview
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-gray-900 tracking-tight">
            Your Command Centre
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            A single interface to direct your entire AI development team
          </p>
        </motion.div>

        <motion.div
          style={{
            rotateX,
            y,
            opacity,
            scale,
            transformStyle: 'preserve-3d',
            transformOrigin: 'center top'
          }}
          className="relative will-change-transform"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-200/30 via-transparent to-emerald-200/30 rounded-2xl blur-3xl" />

          <div className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-800">
                    <span className="text-sm font-bold text-white">P</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    Paynto<span className="text-emerald-700">.AI</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  6 Agents Active
                </span>
                <span className="px-2.5 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {totalTasks} Tasks
                </span>
              </div>
            </div>

            <div className="flex">
              {/* Sidebar */}
              <div className="hidden lg:block w-[280px] flex-shrink-0 border-r border-gray-200 p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Dashboard Builder</h2>
                  <span className="flex items-center gap-1.5 text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
                    Live
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">Current Task</div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-sm text-gray-800">
                      &quot;Build an analytics dashboard with charts and real-time data&quot;
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">Progress</h3>
                    <span className="text-xs text-gray-500">{completedTasks}/{totalTasks}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-600 rounded-full"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${progress}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                  </div>
                  <div className="text-right mt-1 text-xs text-gray-500">{progress}% complete</div>
                </div>

                {/* Activity Feed */}
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">Activity</h3>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
                      </span>
                      Live
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                    {activityFeed.map((activity, i) => {
                      const agent = agents.find(a => a.id === activity.agent)
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-2 text-[10px] py-1 border-b border-gray-100 last:border-0"
                        >
                          <span className="text-gray-400 w-12 flex-shrink-0">{activity.time}</span>
                          <span style={{ color: agent?.color }}>{agent?.emoji}</span>
                          <span className="text-gray-600 truncate">
                            {activity.action} <span className="text-gray-900 font-medium">{activity.detail}</span>
                          </span>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Kanban Board */}
              <div className="flex-1 p-4 bg-white min-h-[400px] overflow-x-auto">
                <div className="flex gap-4 pb-4">
                  {columns.map(column => (
                    <Column
                      key={column.id}
                      column={column}
                      columnTasks={tasks.filter(t => t.column === column.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-gray-500 text-sm mt-6"
        >
          Interactive preview &mdash; the real thing is even better
        </motion.p>
      </div>
    </section>
  )
}
