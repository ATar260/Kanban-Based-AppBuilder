'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    {
      question: "How is this different from other AI code generators?",
      answer: "Most AI tools help you write code faster. Paynto.AI builds complete applications from start to finish. You describe what you want, and our multi-agent system architects, codes, tests, and deploys your entire app. No coding required."
    },
    {
      question: "Can I really build production apps without coding?",
      answer: "Yes! Our AI agents handle everything from system architecture to deployment. You stay in control by reviewing progress, adjusting requirements, and approving changes. The result is production-ready code that follows best practices."
    },
    {
      question: "What kind of apps can I build?",
      answer: "You can build web applications, dashboards, SaaS products, e-commerce sites, internal tools, and more. Our agents work with React, Next.js, TypeScript, and modern web technologies. If you can describe it, we can build it."
    },
    {
      question: "How does the real-time preview work?",
      answer: "As our AI agents write code, you see your app update live in a sandboxed preview environment. You can interact with your app, test features, and see exactly what's being built — all before it's deployed."
    },
    {
      question: "What if something goes wrong?",
      answer: "Our AI automatically detects and fixes most errors. If an issue needs your input, you'll be notified and can chat directly with the agents to provide guidance. You're always in control of the final product."
    },
    {
      question: "Can I export and own my code?",
      answer: "Absolutely! You own 100% of the code we generate. Export your entire codebase anytime — it's clean, well-documented, and follows industry best practices. No vendor lock-in, ever."
    },
    {
      question: "How do I deploy my app?",
      answer: "One click. Seriously. When you're ready, click deploy and your app goes live. We handle builds, optimizations, and CDN distribution automatically. Your app is production-ready in seconds."
    },
    {
      question: "What's the pricing?",
      answer: "We offer a free tier to get started, plus paid plans for serious builders. Contact us for enterprise pricing. During early access, you'll get special founding member rates."
    }
  ]

  return (
    <section className="py-24 md:py-32 px-4 md:px-8 bg-white dark:bg-black">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white tracking-tight">
            Questions?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Everything you need to know about building with Paynto.AI
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors duration-300"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors duration-200"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white pr-4">
                  {faq.question}
                </h3>
                <motion.svg
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </button>

              <motion.div
                initial={false}
                animate={{
                  height: openIndex === index ? 'auto' : 0,
                  opacity: openIndex === index ? 1 : 0
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-5">
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-500 mb-4">
            More questions? We&apos;d love to chat.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-xl transition-colors duration-300"
          >
            Contact Us
          </motion.button>
        </motion.div>
      </div>
    </section>
  )
}
