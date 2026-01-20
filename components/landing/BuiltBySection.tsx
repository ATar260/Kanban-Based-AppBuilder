'use client'

import { motion } from 'framer-motion'


export default function BuiltBySection() {
  const organizations = [
    { name: 'University of Manchester', logo: '/logos/university-of-manchester.png' },
    { name: 'UCL', logo: '/logos/ucl.svg' },
    { name: "King's College London", logo: '/logos/kings-college-london.png' },
    { name: 'Entrepreneur First', logo: '/logos/Entrepreneurs_First_Logo.png' },
    { name: 'Microsoft', logo: '/logos/microsoft.png' },
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
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-comfort-sage-50 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-comfort-sage-50 to-transparent z-10 pointer-events-none" />

          <div className="flex">
            <motion.div
              animate={{
                x: ['0%', '-50%']
              }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 25,
                  ease: "linear",
                },
              }}
              className="flex gap-12 py-6 shrink-0"
            >
              {[...organizations, ...organizations, ...organizations, ...organizations].map((org, i) => (
                <motion.div
                  key={`${org.name}-${i}`}
                  className="flex items-center justify-center flex-shrink-0 p-4 bg-white rounded-xl border border-comfort-sage-200/80 hover:border-comfort-sage-400 hover:shadow-lg transition-all shadow-sm h-32 w-[300px]"
                  whileHover={{ scale: 1.05, y: -3 }}
                >
                  <img
                    src={org.logo}
                    alt={`${org.name} logo`}
                    className="w-full h-full object-contain"
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
