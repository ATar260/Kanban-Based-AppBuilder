'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

export default function BackedBySection() {
  return (
    <section className="py-8 bg-comfort-sage-100 border-t border-comfort-sage-200">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-4 px-6 py-3">
            <span className="text-sm font-medium text-comfort-charcoal-400">Backed by</span>
            <motion.a
              href="https://www.conceptionx.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <Image
                src="/conceptionx-logo.png"
                alt="ConceptionX Logo"
                width={140}
                height={40}
                className="h-8 w-auto"
              />
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
