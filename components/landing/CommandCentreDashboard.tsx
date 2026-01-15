'use client'

import { motion } from 'framer-motion'

const agents = [
  { id: 'architect', name: 'Architect', emoji: '🏗️', color: '#7B5EA7' },
  { id: 'planner', name: 'Planner', emoji: '📋', color: '#5E9A68' },
  { id: 'coder', name: 'Coder', emoji: '💻', color: '#6BA875' },
  { id: 'tester', name: 'Tester', emoji: '🧪', color: '#E07B54' },
  { id: 'devops', name: 'DevOps', emoji: '🚀', color: '#4D8957' },
  { id: 'designer', name: 'Designer', emoji: '🎨', color: '#D4699A' },
]

const columns = [
  { id: 'backlog', name: 'Backlog', emoji: '📥' },
  { id: 'todo', name: 'To Do', emoji: '📝' },
  { id: 'inprogress', name: 'In Progress', emoji: '🔄' },
  { id: 'review', name: 'Review', emoji: '👀' },
  { id: 'testing', name: 'Testing', emoji: '🧪' },
  { id: 'done', name: 'Done', emoji: '✅' },
]

const tasks = [
  // Backlog
  { id: 'TSK-012', title: 'Add dark mode support', column: 'backlog', agent: 'designer' },
  { id: 'TSK-013', title: 'Optimize bundle size', column: 'backlog', agent: 'devops' },
  { id: 'TSK-014', title: 'Add export feature', column: 'backlog', agent: 'coder' },
  // To Do
  { id: 'TSK-009', title: 'Design settings page', column: 'todo', agent: 'designer' },
  { id: 'TSK-010', title: 'Plan API v2 endpoints', column: 'todo', agent: 'planner' },
  { id: 'TSK-011', title: 'Create auth system', column: 'todo', agent: 'architect' },
  // In Progress
  { id: 'TSK-003', title: 'Build navigation', column: 'inprogress', agent: 'coder', progress: 65 },
  { id: 'TSK-004', title: 'API integration', column: 'inprogress', agent: 'coder', progress: 40 },
  { id: 'TSK-005', title: 'Dashboard layout', column: 'inprogress', agent: 'designer', progress: 80 },
  // Review
  { id: 'TSK-006', title: 'User profile page', column: 'review', agent: 'designer' },
  { id: 'TSK-015', title: 'Database schema', column: 'review', agent: 'architect' },
  // Testing
  { id: 'TSK-016', title: 'Unit tests - Auth', column: 'testing', agent: 'tester' },
  { id: 'TSK-017', title: 'E2E tests - Flow', column: 'testing', agent: 'tester' },
  { id: 'TSK-018', title: 'Performance tests', column: 'testing', agent: 'tester' },
  // Done
  { id: 'TSK-001', title: 'Project setup', column: 'done', agent: 'devops' },
  { id: 'TSK-002', title: 'CI/CD pipeline', column: 'done', agent: 'devops' },
  { id: 'TSK-007', title: 'Settings page', column: 'done', agent: 'coder' },
  { id: 'TSK-008', title: 'Database setup', column: 'done', agent: 'devops' },
]

const activityFeed = [
  { time: '2s', agent: 'coder', action: 'Committed', detail: 'Navigation.tsx' },
  { time: '8s', agent: 'designer', action: 'Updated', detail: 'Dashboard layout' },
  { time: '15s', agent: 'architect', action: 'Approved', detail: 'API schema' },
  { time: '22s', agent: 'tester', action: 'Passed', detail: 'Auth unit tests' },
  { time: '35s', agent: 'devops', action: 'Deployed', detail: 'Preview v1.2.3' },
  { time: '48s', agent: 'planner', action: 'Created', detail: 'Sprint backlog' },
  { time: '1m', agent: 'coder', action: 'Fixed', detail: 'API endpoint bug' },
]

function AgentAvatar({ agentId, size = 'md' }: { agentId: string; size?: 'sm' | 'md' }) {
  const agent = agents.find(a => a.id === agentId)
  if (!agent) return null

  const sizeClasses = size === 'sm' ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-sm'

  return (
    <div
      className={`${sizeClasses} rounded-full flex items-center justify-center flex-shrink-0`}
      style={{ backgroundColor: `${agent.color}20` }}
      title={agent.name}
    >
      {agent.emoji}
    </div>
  )
}

function DashboardCard({ task, isActive = false }: { task: typeof tasks[0]; isActive?: boolean }) {
  const agent = agents.find(a => a.id === task.agent)

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
      className="bg-white rounded-lg px-3 py-2 border border-comfort-sage-200 shadow-sm cursor-pointer"
      style={{ aspectRatio: '3 / 1', minHeight: '56px' }}
    >
      <div className="flex items-center justify-between h-full gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-[11px] font-medium text-comfort-charcoal-700 truncate leading-tight">
            {task.title}
          </h4>
          <span className="text-[9px] text-comfort-charcoal-400 font-mono">{task.id}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isActive && task.progress && (
            <div className="w-8 h-1 bg-comfort-sage-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: agent?.color }}
                initial={{ width: 0 }}
                animate={{ width: `${task.progress}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          )}
          <AgentAvatar agentId={task.agent} size="sm" />
        </div>
      </div>
    </motion.div>
  )
}

function KanbanColumn({ column, columnTasks }: { column: typeof columns[0]; columnTasks: typeof tasks }) {
  const isActive = column.id === 'inprogress'

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <span className="text-sm">{column.emoji}</span>
        <h3 className="text-[11px] font-semibold text-comfort-charcoal-700 truncate">{column.name}</h3>
        <span className="text-[10px] text-comfort-charcoal-400 bg-comfort-sage-100 px-1.5 py-0.5 rounded-full ml-auto">
          {columnTasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {columnTasks.map(task => (
          <DashboardCard key={task.id} task={task} isActive={isActive} />
        ))}
      </div>
    </div>
  )
}

function ActivityFeed() {
  return (
    <div className="w-48 flex-shrink-0 border-l border-comfort-sage-200 bg-comfort-sage-50/50 hidden lg:block">
      <div className="px-3 py-2 border-b border-comfort-sage-200 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-comfort-charcoal-700">Activity</h3>
        <span className="flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-comfort-sage-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-comfort-sage-500"></span>
          </span>
          <span className="text-[9px] text-comfort-sage-600">Live</span>
        </span>
      </div>
      <div className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(40vh - 100px)' }}>
        {activityFeed.map((activity, i) => {
          const agent = agents.find(a => a.id === activity.agent)
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-2 py-1.5 border-b border-comfort-sage-100 last:border-0"
            >
              <span className="text-[9px] text-comfort-charcoal-400 w-6 flex-shrink-0">{activity.time}</span>
              <span className="text-xs flex-shrink-0">{agent?.emoji}</span>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-comfort-charcoal-500 block truncate">
                  {activity.action}
                </span>
                <span className="text-[10px] text-comfort-charcoal-700 font-medium block truncate">
                  {activity.detail}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function StatsBar() {
  const completedTasks = tasks.filter(t => t.column === 'done').length
  const totalTasks = tasks.length
  const progress = Math.round((completedTasks / totalTasks) * 100)

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-comfort-sage-200 bg-comfort-sage-50/80">
      <div className="flex items-center gap-4 md:gap-6">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-comfort-sage-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-comfort-sage-500"></span>
          </span>
          <span className="text-xs font-medium text-comfort-charcoal-700">6 Agents</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-xs text-comfort-charcoal-500">{totalTasks} Tasks</span>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <div className="w-20 h-1.5 bg-comfort-sage-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-comfort-sage-500 rounded-full"
              initial={{ width: 0 }}
              whileInView={{ width: `${progress}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          </div>
          <span className="text-xs font-medium text-comfort-sage-600">{progress}%</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-comfort-charcoal-400 hidden sm:block">Dashboard Builder</span>
        <span className="px-2 py-1 text-[10px] bg-comfort-sage-100 text-comfort-sage-700 rounded-full font-medium">
          Live Preview
        </span>
      </div>
    </div>
  )
}

export default function CommandCentreDashboard() {
  return (
    <section id="demo" className="min-h-[35vh] md:min-h-[40vh] lg:min-h-[45vh] bg-comfort-sage-50 py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-6"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-comfort-charcoal-800 mb-2">
            Your Command Centre
          </h2>
          <p className="text-sm text-comfort-charcoal-500">
            Direct your AI development team from a single interface
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white border border-comfort-sage-300 rounded-2xl overflow-hidden shadow-xl shadow-comfort-charcoal-800/5"
        >
          <StatsBar />

          <div className="flex">
            {/* Kanban Board - 6 Columns */}
            <div className="flex-1 p-3 md:p-4 overflow-x-auto">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 min-w-[600px] md:min-w-0">
                {columns.map(column => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    columnTasks={tasks.filter(t => t.column === column.id)}
                  />
                ))}
              </div>
            </div>

            {/* Activity Feed - Right Side */}
            <ActivityFeed />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center text-comfort-charcoal-400 text-xs mt-4"
        >
          Interactive preview — the real thing is even better
        </motion.p>
      </div>
    </section>
  )
}
