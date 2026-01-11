'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

export default function BuiltBySection() {
  const organizations = [
    { name: 'University of Manchester', logo: '/logos/manchester.svg', isPlaceholder: true },
    { name: 'UCL', logo: '/logos/ucl.svg', isPlaceholder: false },
    { name: "King's College London", logo: '/logos/kings.svg', isPlaceholder: true },
    { name: 'Entrepreneur First', logo: '/logos/ef.svg', isPlaceholder: true },
    { name: 'Microsoft', logo: '/logos/microsoft.png', isPlaceholder: false },
  ]

  return (
    <section className="py-8 bg-comfort-sage-50/50">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6"
        >
          <p className="text-sm font-medium text-comfort-charcoal-400 uppercase tracking-wide">
            Made by a team from
          </p>
        </motion.div>

        <div className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-comfort-sage-50/80 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-comfort-sage-50/80 to-transparent z-10 pointer-events-none" />

          <motion.div
            animate={{
              x: ['0%', '-50%']
            }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: 20,
                ease: "linear",
              },
            }}
            className="flex gap-10 py-4"
          >
            {[...organizations, ...organizations].map((org, i) => (
              <motion.div
                key={`${org.name}-${i}`}
                className="flex items-center justify-center flex-shrink-0 px-4 py-2 bg-white rounded-xl border border-comfort-sage-200/80 hover:border-comfort-sage-400 hover:shadow-md transition-all shadow-sm"
                whileHover={{ scale: 1.03, y: -2 }}
              >
                <Image
                  src={org.logo}
                  alt={`${org.name} logo`}
                  width={140}
                  height={40}
                  className="h-8 w-auto object-contain"
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
