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
    <section id="faq" className="py-12 md:py-16 bg-comfort-sage-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-comfort-charcoal-800 tracking-tight">
            Questions?
          </h2>
          <p className="text-lg text-comfort-charcoal-500 max-w-2xl mx-auto">
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
              className="bg-comfort-sage-100 rounded-2xl overflow-hidden border border-comfort-sage-300 hover:border-comfort-sage-300 transition-colors duration-300"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-comfort-sage-200 transition-colors duration-200"
              >
                <h3 className="text-lg font-semibold text-comfort-charcoal-800 pr-4">
                  {faq.question}
                </h3>
                <motion.svg
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-5 h-5 text-comfort-charcoal-400 flex-shrink-0"
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
                  <p className="text-comfort-charcoal-500 leading-relaxed">
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
          <p className="text-comfort-charcoal-500 mb-4">
            More questions? We&apos;d love to chat.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3 bg-comfort-sage-200 hover:bg-comfort-sage-300 text-comfort-charcoal-800 font-medium rounded-xl transition-colors duration-300"
          >
            Contact Us
          </motion.button>
        </motion.div>
      </div>
    </section>
  )
}
