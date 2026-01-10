'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    role: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit. Please try again.')
      }

      setIsSubmitted(true)
      setFormData({ name: '', email: '', company: '', role: '', message: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  if (isSubmitted) {
    return (
      <section id="contact" className="py-12 md:py-16 bg-gradient-to-b from-comfort-sage-100 to-comfort-sage-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-comfort-sage-300 rounded-2xl p-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-comfort-sage-500 to-comfort-sage-600 mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-comfort-charcoal-800 mb-4">You&apos;re on the list!</h2>
            <p className="text-comfort-charcoal-500">We&apos;ll be in touch soon with early access to Paynto.AI.</p>
          </motion.div>
        </div>
      </section>
    )
  }

  return (
    <section id="contact" className="py-12 md:py-16 bg-gradient-to-b from-comfort-sage-100 to-comfort-sage-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center px-3 py-1.5 mb-4 text-sm font-medium text-comfort-terracotta-600 bg-comfort-terracotta-100 rounded-full border border-comfort-terracotta-300">
            Early Access
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-comfort-charcoal-800 tracking-tight">
            Start Building Today
          </h2>
          <p className="text-lg text-comfort-charcoal-500 max-w-2xl mx-auto">
            Join the waitlist to be among the first to build with AI agents.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.8 }}
          onSubmit={handleSubmit}
          className="bg-comfort-sage-50 border border-comfort-sage-300 rounded-2xl p-8 md:p-10 max-w-2xl mx-auto shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-comfort-charcoal-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-comfort-sage-300 bg-white text-comfort-charcoal-800 placeholder-comfort-charcoal-400 focus:ring-2 focus:ring-comfort-sage-500 focus:border-transparent transition-all duration-200"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-comfort-charcoal-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-comfort-sage-300 bg-white text-comfort-charcoal-800 placeholder-comfort-charcoal-400 focus:ring-2 focus:ring-comfort-sage-500 focus:border-transparent transition-all duration-200"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-comfort-charcoal-700 mb-2">
                Company
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-comfort-sage-300 bg-white text-comfort-charcoal-800 placeholder-comfort-charcoal-400 focus:ring-2 focus:ring-comfort-sage-500 focus:border-transparent transition-all duration-200"
                placeholder="Your company"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-comfort-charcoal-700 mb-2">
                Role
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-comfort-sage-300 bg-white text-comfort-charcoal-800 focus:ring-2 focus:ring-comfort-sage-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Select role</option>
                <option value="founder">Founder / CEO</option>
                <option value="cto">CTO / VP Engineering</option>
                <option value="engineering-manager">Engineering Manager</option>
                <option value="developer">Developer</option>
                <option value="product">Product Manager</option>
                <option value="designer">Designer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="mb-8">
            <label htmlFor="message" className="block text-sm font-medium text-comfort-charcoal-700 mb-2">
              What would you build with AI?
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              value={formData.message}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-comfort-sage-300 bg-white text-comfort-charcoal-800 placeholder-comfort-charcoal-400 focus:ring-2 focus:ring-comfort-sage-500 focus:border-transparent transition-all duration-200"
              placeholder="Tell us about your dream project..."
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 rounded-xl bg-comfort-terracotta-100 border border-comfort-terracotta-300 text-comfort-terracotta-700 text-sm"
            >
              {error}
            </motion.div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="w-full px-8 py-4 bg-gradient-to-r from-comfort-sage-500 to-comfort-sage-600 text-white font-semibold text-lg rounded-xl shadow-lg shadow-comfort-sage-500/25 hover:shadow-xl hover:shadow-comfort-sage-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Joining...' : 'Join the Waitlist'}
          </motion.button>

          <p className="text-center text-comfort-charcoal-500 text-sm mt-4">
            No spam. We&apos;ll only contact you about early access.
          </p>
        </motion.form>
      </div>
    </section>
  )
}
