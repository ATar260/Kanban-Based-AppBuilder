'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const openPositions = [
  {
    title: 'Senior Full-Stack Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Build and scale our AI-powered development platform. Work with Next.js, TypeScript, and cutting-edge AI technologies.',
  },
  {
    title: 'AI/ML Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Design and implement AI models that power our code generation and understanding capabilities.',
  },
  {
    title: 'Product Designer',
    department: 'Design',
    location: 'Remote',
    type: 'Full-time',
    description: 'Shape the future of AI-assisted development through intuitive and delightful user experiences.',
  },
  {
    title: 'Developer Advocate',
    department: 'Marketing',
    location: 'Remote',
    type: 'Full-time',
    description: 'Build community, create content, and help developers succeed with Paynto.AI.',
  },
]

const benefits = [
  { icon: '🌍', title: 'Remote-First', description: 'Work from anywhere in the world' },
  { icon: '💰', title: 'Competitive Pay', description: 'Top-tier salary and equity packages' },
  { icon: '🏥', title: 'Health Benefits', description: 'Comprehensive health, dental, and vision' },
  { icon: '📚', title: 'Learning Budget', description: '$2,000/year for courses and conferences' },
  { icon: '🏖️', title: 'Unlimited PTO', description: 'Take the time you need to recharge' },
  { icon: '💻', title: 'Equipment', description: 'Top-of-the-line setup for your home office' },
]

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-comfort-sage-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-comfort-sage-100 to-comfort-sage-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center text-comfort-sage-600 hover:text-comfort-sage-700 mb-8"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center px-3 py-1.5 mb-4 text-sm font-medium text-comfort-sage-700 bg-comfort-sage-100 rounded-full border border-comfort-sage-300">
              We&apos;re Hiring
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-comfort-charcoal-800 mb-6">
              Build the Future of
              <br />
              <span className="text-comfort-sage-600">AI Development</span>
            </h1>
            <p className="text-xl text-comfort-charcoal-500 max-w-2xl">
              Join our mission to make software development accessible to everyone.
              We&apos;re looking for passionate people to help shape the future of how apps are built.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl font-bold text-comfort-charcoal-800 mb-8">Why Paynto.AI?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white border border-comfort-sage-200 rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="text-3xl mb-3">{benefit.icon}</div>
                <h3 className="font-semibold text-comfort-charcoal-800 mb-1">{benefit.title}</h3>
                <p className="text-sm text-comfort-charcoal-500">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Open Positions */}
      <div className="bg-comfort-sage-100 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl font-bold text-comfort-charcoal-800 mb-8">Open Positions</h2>
            <div className="space-y-4">
              {openPositions.map((position, index) => (
                <motion.div
                  key={position.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white border border-comfort-sage-200 rounded-xl p-6 hover:shadow-md hover:border-comfort-sage-300 transition-all cursor-pointer group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-comfort-charcoal-800 group-hover:text-comfort-sage-600 transition-colors">
                        {position.title}
                      </h3>
                      <p className="text-sm text-comfort-charcoal-500 mt-1">{position.description}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-comfort-charcoal-600 bg-comfort-sage-100 rounded-full">
                          {position.department}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-comfort-charcoal-600 bg-comfort-sage-100 rounded-full">
                          {position.location}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-comfort-charcoal-600 bg-comfort-sage-100 rounded-full">
                          {position.type}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center text-comfort-sage-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                        Apply
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-br from-comfort-sage-500 to-comfort-sage-600 rounded-2xl p-8 sm:p-12 text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Don&apos;t see a perfect fit?
          </h2>
          <p className="text-comfort-sage-100 mb-6 max-w-xl mx-auto">
            We&apos;re always looking for talented people. Send us your resume and tell us how you&apos;d like to contribute.
          </p>
          <a
            href="mailto:careers@paynto.ai"
            className="inline-flex items-center px-6 py-3 bg-white text-comfort-sage-600 font-semibold rounded-xl hover:bg-comfort-sage-50 transition-colors"
          >
            Get in Touch
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </motion.div>
      </div>
    </div>
  )
}
