'use client'

import { motion, useScroll, useTransform, AnimatePresence, Reorder } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'

const agents = [
  { id: 'architect', name: 'Architect', emoji: '🏗️', color: '#7FB589' },
  { id: 'coder', name: 'Coder', emoji: '💻', color: '#6BA875' },
  { id: 'designer', name: 'Designer', emoji: '🎨', color: '#8FC298' },
  { id: 'planner', name: 'Planner', emoji: '📋', color: '#5E9A68' },
  { id: 'tester', name: 'Tester', emoji: '🧪', color: '#7FB589' },
  { id: 'devops', name: 'DevOps', emoji: '🚀', color: '#4D8957' },
]

const columnsData = [
  { id: 'todo', name: 'To Do', color: '#5E9A68', emoji: '📝', description: 'Waiting to start' },
  { id: 'inprogress', name: 'In Progress', color: '#7FB589', emoji: '🔄', description: 'Agents working' },
  { id: 'review', name: 'Review', color: '#6BA875', emoji: '👀', description: 'Ready for review' },
  { id: 'done', name: 'Done', color: '#8FC298', emoji: '✅', description: 'Completed' },
]

const initialTasks = [
  { id: 'TSK-001', title: 'Design dashboard layout', column: 'todo', priority: 'high', agent: 'designer', progress: 0 },
  { id: 'TSK-002', title: 'Create auth system', column: 'todo', priority: 'high', agent: 'architect', progress: 0 },
  { id: 'TSK-003', title: 'Build navigation', column: 'inprogress', priority: 'medium', agent: 'coder', progress: 65 },
  { id: 'TSK-004', title: 'API integration', column: 'inprogress', priority: 'high', agent: 'coder', progress: 40 },
  { id: 'TSK-005', title: 'Unit tests', column: 'inprogress', priority: 'medium', agent: 'tester', progress: 80 },
  { id: 'TSK-006', title: 'User profile page', column: 'review', priority: 'medium', agent: 'designer', progress: 100 },
  { id: 'TSK-007', title: 'Settings page', column: 'done', priority: 'low', agent: 'coder', progress: 100 },
  { id: 'TSK-008', title: 'Database setup', column: 'done', priority: 'high', agent: 'devops', progress: 100 },
]

const initialActivityFeed = [
  { time: '2s ago', agent: 'coder', action: 'Committed', detail: 'Navigation.tsx' },
  { time: '5s ago', agent: 'architect', action: 'Approved', detail: 'API schema' },
  { time: '12s ago', agent: 'designer', action: 'Created', detail: 'ProfileCard.tsx' },
  { time: '18s ago', agent: 'tester', action: 'Passed', detail: 'Auth tests' },
  { time: '30s ago', agent: 'devops', action: 'Deployed', detail: 'Preview build' },
]

const newActivities = [
  { agent: 'coder', action: 'Updated', detail: 'Button.tsx' },
  { agent: 'designer', action: 'Styled', detail: 'Modal component' },
  { agent: 'tester', action: 'Running', detail: 'Integration tests' },
  { agent: 'architect', action: 'Reviewed', detail: 'Database schema' },
  { agent: 'devops', action: 'Configured', detail: 'CI pipeline' },
  { agent: 'planner', action: 'Created', detail: 'Sprint backlog' },
]

type Task = typeof initialTasks[0]

function AgentBadge({ agentId, showPulse = false, onClick }: { agentId: string, showPulse?: boolean, onClick?: () => void }) {
  const agent = agents.find(a => a.id === agentId)
  if (!agent) return null

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full text-xs px-1.5 py-0.5 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
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

function TaskCard({
  task,
  isActive = false,
  isSelected = false,
  onSelect,
  onDragToColumn
}: {
  task: Task,
  isActive?: boolean,
  isSelected?: boolean,
  onSelect: () => void,
  onDragToColumn: (columnId: string) => void
}) {
  const priorityColors: Record<string, string> = {
    high: 'bg-comfort-terracotta-100 text-comfort-terracotta-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-comfort-sage-100 text-comfort-sage-700',
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isSelected ? 1.02 : 1,
        boxShadow: isSelected ? '0 8px 30px rgba(0, 0, 0, 0.12)' : '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)' }}
      whileTap={{ scale: 0.98 }}
      drag
      dragSnapToOrigin
      onDragEnd={(_, info) => {
        // Determine which column based on drag offset
        if (Math.abs(info.offset.x) > 100) {
          const direction = info.offset.x > 0 ? 1 : -1
          const currentIndex = columnsData.findIndex(c => c.id === task.column)
          const newIndex = Math.max(0, Math.min(columnsData.length - 1, currentIndex + direction))
          if (newIndex !== currentIndex) {
            onDragToColumn(columnsData[newIndex].id)
          }
        }
      }}
      onClick={onSelect}
      className={`bg-white border rounded-[16px] p-3 cursor-grab active:cursor-grabbing transition-colors duration-200 ${
        isSelected ? 'border-comfort-sage-500 ring-2 ring-comfort-sage-200' : 'border-comfort-sage-300'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        <span className="text-[10px] text-comfort-charcoal-400 font-mono">{task.id}</span>
      </div>
      <h4 className="text-sm font-medium text-comfort-charcoal-800 mb-2">{task.title}</h4>

      {task.progress > 0 && task.progress < 100 && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-comfort-charcoal-400 mb-1">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <div className="h-1 bg-comfort-sage-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-comfort-sage-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${task.progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-comfort-sage-200">
        <AgentBadge agentId={task.agent} showPulse={isActive} />
        {isSelected && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[10px] text-comfort-sage-600 font-medium"
          >
            Selected
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}

function Column({
  column,
  columnTasks,
  selectedTaskId,
  onSelectTask,
  onMoveTask
}: {
  column: typeof columnsData[0],
  columnTasks: Task[],
  selectedTaskId: string | null,
  onSelectTask: (id: string) => void,
  onMoveTask: (taskId: string, columnId: string) => void
}) {
  return (
    <div className="flex-shrink-0 w-[200px]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{column.emoji}</span>
        <div>
          <h3 className="text-xs font-semibold text-comfort-charcoal-800">{column.name}</h3>
          <p className="text-[9px] text-comfort-charcoal-400">{column.description}</p>
        </div>
        <motion.span
          key={columnTasks.length}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="text-[10px] text-comfort-charcoal-400 bg-comfort-sage-200 px-1.5 py-0.5 rounded-full ml-auto"
        >
          {columnTasks.length}
        </motion.span>
      </div>
      <div className="space-y-2 min-h-[100px]">
        <AnimatePresence mode="popLayout">
          {columnTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              isActive={column.id === 'inprogress'}
              isSelected={selectedTaskId === task.id}
              onSelect={() => onSelectTask(task.id)}
              onDragToColumn={(columnId) => onMoveTask(task.id, columnId)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function MockUI() {
  const sectionRef = useRef<HTMLElement>(null)
  const [tasks, setTasks] = useState(initialTasks)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activityFeed, setActivityFeed] = useState(initialActivityFeed)
  const [activityIndex, setActivityIndex] = useState(0)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  })

  const rotateX = useTransform(scrollYProgress, [0, 0.3, 0.5], [-90, -30, 0])
  const y = useTransform(scrollYProgress, [0, 0.3, 0.5], [50, 20, 0])
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.4], [0, 0.8, 1])
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.5], [0.9, 0.95, 1])

  // Simulate live activity updates
  useEffect(() => {
    const interval = setInterval(() => {
      const newActivity = newActivities[activityIndex % newActivities.length]
      setActivityFeed(prev => [
        { ...newActivity, time: 'just now' },
        ...prev.slice(0, 4).map((a, i) => ({
          ...a,
          time: i === 0 ? '3s ago' : i === 1 ? '8s ago' : i === 2 ? '15s ago' : '25s ago'
        }))
      ])
      setActivityIndex(prev => prev + 1)
    }, 4000)

    return () => clearInterval(interval)
  }, [activityIndex])

  // Simulate progress updates for in-progress tasks
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(prev => prev.map(task => {
        if (task.column === 'inprogress' && task.progress < 100) {
          const newProgress = Math.min(100, task.progress + Math.floor(Math.random() * 5) + 1)
          return { ...task, progress: newProgress }
        }
        return task
      }))
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const handleMoveTask = (taskId: string, newColumnId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        // Update progress based on column
        let newProgress = task.progress
        if (newColumnId === 'done') newProgress = 100
        else if (newColumnId === 'todo') newProgress = 0
        else if (newColumnId === 'review') newProgress = 100

        // Add activity for the move
        const agent = agents.find(a => a.id === task.agent)
        const column = columnsData.find(c => c.id === newColumnId)
        if (agent && column) {
          setActivityFeed(prev => [
            { time: 'just now', agent: task.agent, action: 'Moved to', detail: column.name },
            ...prev.slice(0, 4)
          ])
        }

        return { ...task, column: newColumnId, progress: newProgress }
      }
      return task
    }))
  }

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(prev => prev === taskId ? null : taskId)
  }

  const completedTasks = tasks.filter(t => t.column === 'done').length
  const totalTasks = tasks.length
  const progress = Math.round((completedTasks / totalTasks) * 100)

  const selectedTask = tasks.find(t => t.id === selectedTaskId)

  return (
    <section ref={sectionRef} id="demo" className="py-16 md:py-24 bg-comfort-sage-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center px-5 py-2 mb-6 text-sm font-medium text-comfort-sage-700 bg-comfort-sage-100 rounded-full">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-comfort-sage-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-comfort-sage-500"></span>
            </span>
            Interactive Demo
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5 text-comfort-charcoal-800 tracking-tight">
            Your Command Centre
          </h2>
          <p className="text-lg text-comfort-charcoal-500 max-w-2xl mx-auto leading-relaxed">
            Drag cards between columns, click to select, and watch live updates
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
          <div className="absolute inset-0 bg-gradient-to-r from-comfort-sage-200/30 via-transparent to-comfort-sage-200/30 rounded-[24px] blur-3xl" />

          <div className="relative bg-white border border-comfort-sage-300 rounded-[24px] overflow-hidden shadow-xl shadow-comfort-charcoal-800/5">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-comfort-sage-200 bg-comfort-sage-50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Image
                    src="/paynto-logo.png"
                    alt="Paynto.AI"
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-[12px]"
                  />
                  <span className="text-lg font-bold text-comfort-charcoal-800">
                    Paynto<span className="text-comfort-sage-600">.AI</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-comfort-sage-100 text-comfort-sage-700 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-comfort-sage-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-comfort-sage-500"></span>
                  </span>
                  6 Agents Active
                </span>
                <motion.span
                  key={totalTasks}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="px-2.5 py-1.5 text-xs bg-comfort-sage-200 text-comfort-charcoal-600 rounded-full"
                >
                  {totalTasks} Tasks
                </motion.span>
              </div>
            </div>

            <div className="flex">
              {/* Sidebar */}
              <div className="hidden lg:block w-[280px] flex-shrink-0 border-r border-comfort-sage-200 p-4 bg-comfort-sage-50">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-comfort-charcoal-800">Dashboard Builder</h2>
                  <span className="flex items-center gap-1.5 text-xs px-2 py-1 bg-comfort-sage-100 text-comfort-sage-700 rounded-full">
                    <span className="w-1.5 h-1.5 bg-comfort-sage-500 rounded-full animate-pulse"></span>
                    Live
                  </span>
                </div>

                {/* Selected Task or Current Task */}
                <div className="mb-4">
                  <div className="text-xs text-comfort-charcoal-400 mb-2">
                    {selectedTask ? 'Selected Task' : 'Current Task'}
                  </div>
                  <motion.div
                    key={selectedTask?.id || 'default'}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-comfort-sage-50 border border-comfort-sage-200 rounded-[16px] p-3"
                  >
                    {selectedTask ? (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-comfort-charcoal-400">{selectedTask.id}</span>
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${
                            selectedTask.priority === 'high' ? 'bg-comfort-terracotta-100 text-comfort-terracotta-700' :
                            selectedTask.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-comfort-sage-100 text-comfort-sage-700'
                          }`}>
                            {selectedTask.priority}
                          </span>
                        </div>
                        <p className="text-sm text-comfort-charcoal-700 font-medium mb-2">{selectedTask.title}</p>
                        <AgentBadge agentId={selectedTask.agent} />
                      </div>
                    ) : (
                      <p className="text-sm text-comfort-charcoal-700">
                        &quot;Build an analytics dashboard with charts and real-time data&quot;
                      </p>
                    )}
                  </motion.div>
                </div>

                {/* Progress */}
                <div className="bg-white border border-comfort-sage-200 rounded-[16px] p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-comfort-charcoal-800">Progress</h3>
                    <motion.span
                      key={completedTasks}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      className="text-xs text-comfort-charcoal-400"
                    >
                      {completedTasks}/{totalTasks}
                    </motion.span>
                  </div>
                  <div className="h-2 bg-comfort-sage-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-comfort-sage-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <div className="text-right mt-1 text-xs text-comfort-charcoal-400">{progress}% complete</div>
                </div>

                {/* Activity Feed */}
                <div className="bg-white border border-comfort-sage-200 rounded-[16px] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-comfort-charcoal-800">Activity</h3>
                    <span className="flex items-center gap-1 text-[10px] text-comfort-sage-600">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-comfort-sage-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-comfort-sage-500"></span>
                      </span>
                      Live
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                      {activityFeed.map((activity, i) => {
                        const agent = agents.find(a => a.id === activity.agent)
                        return (
                          <motion.div
                            key={`${activity.detail}-${i}`}
                            initial={{ opacity: 0, x: -10, height: 0 }}
                            animate={{ opacity: 1, x: 0, height: 'auto' }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-center gap-2 text-[10px] py-1 border-b border-comfort-sage-100 last:border-0"
                          >
                            <span className="text-comfort-charcoal-400 w-12 flex-shrink-0">{activity.time}</span>
                            <span style={{ color: agent?.color }}>{agent?.emoji}</span>
                            <span className="text-comfort-charcoal-500 truncate">
                              {activity.action} <span className="text-comfort-charcoal-700 font-medium">{activity.detail}</span>
                            </span>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Kanban Board */}
              <div className="flex-1 p-3 bg-white min-h-[320px] overflow-x-auto">
                <div className="flex gap-3 pb-3 min-w-[750px]">
                  {columnsData.map(column => (
                    <Column
                      key={column.id}
                      column={column}
                      columnTasks={tasks.filter(t => t.column === column.id)}
                      selectedTaskId={selectedTaskId}
                      onSelectTask={handleSelectTask}
                      onMoveTask={handleMoveTask}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <p className="text-comfort-charcoal-400 text-sm mb-2">
            Try it out &mdash; drag cards between columns!
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-comfort-charcoal-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-comfort-sage-400"></span>
              Click to select
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-comfort-sage-500"></span>
              Drag to move
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-comfort-sage-600 animate-pulse"></span>
              Live updates
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
