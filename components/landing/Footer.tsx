'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

const socialLinks = [
  { name: 'Twitter', icon: '𝕏', href: 'https://twitter.com/payntoai', external: true },
  { name: 'GitHub', icon: '⌂', href: 'https://github.com/payntoai', external: true },
  { name: 'Discord', icon: '💬', href: 'https://discord.gg/payntoai', external: true },
  { name: 'LinkedIn', icon: '🔗', href: 'https://linkedin.com/company/payntoai', external: true },
]

export default function Footer() {
  return (
    <footer className="bg-comfort-sage-50 border-t border-comfort-sage-200">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
      >
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div className="lg:col-span-2">
            <div className="mb-6">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/paynto-logo.png"
                  alt="Paynto.AI Logo"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-xl"
                />
                <span className="text-2xl font-bold text-comfort-charcoal-800">
                  Paynto<span className="text-comfort-sage-600">.</span>AI
                </span>
              </Link>
            </div>
            <p className="text-comfort-charcoal-500 max-w-md leading-relaxed mb-6">
              The Kanban Command Centre for AI-Powered App Development.
              Don&apos;t write code &mdash; direct it.
            </p>
            <div className="flex items-center gap-4 mb-6">
              <motion.div
                className="flex items-center gap-2 text-sm text-comfort-charcoal-500"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <motion.div
                  className="w-2 h-2 bg-comfort-sage-500 rounded-full"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                Building the future
              </motion.div>
            </div>
            {/* Social Links */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social, i) => (
                <motion.a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="w-10 h-10 rounded-xl bg-white border border-comfort-sage-200 flex items-center justify-center text-lg hover:bg-comfort-sage-100 transition-colors"
                  aria-label={social.name}
                >
                  {social.icon}
                </motion.a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-comfort-charcoal-800 mb-4">Product</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/generation" className="text-comfort-charcoal-500 hover:text-comfort-charcoal-800 transition-colors duration-200">Get Started</Link></li>
              <li><Link href="/#features" className="text-comfort-charcoal-500 hover:text-comfort-charcoal-800 transition-colors duration-200">Features</Link></li>
              <li><Link href="/#pricing" className="text-comfort-charcoal-500 hover:text-comfort-charcoal-800 transition-colors duration-200">Pricing</Link></li>
              <li><Link href="/#how-it-works" className="text-comfort-charcoal-500 hover:text-comfort-charcoal-800 transition-colors duration-200">How It Works</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-comfort-charcoal-800 mb-4">Company</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/careers" className="text-comfort-charcoal-500 hover:text-comfort-charcoal-800 transition-colors duration-200">Careers</Link></li>
              <li><Link href="/terms" className="text-comfort-charcoal-500 hover:text-comfort-charcoal-800 transition-colors duration-200">Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-comfort-charcoal-500 hover:text-comfort-charcoal-800 transition-colors duration-200">Privacy Policy</Link></li>
              <li><Link href="/#contact" className="text-comfort-charcoal-500 hover:text-comfort-charcoal-800 transition-colors duration-200">Contact</Link></li>
            </ul>
          </div>
        </div>

        {/* Fun animated divider */}
        <div className="relative py-4 mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-comfort-sage-200" />
          </div>
          <div className="relative flex justify-center">
            <motion.span
              className="px-4 bg-comfort-sage-50 text-2xl"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              ⚡
            </motion.span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-comfort-charcoal-500">
            &copy; 2026 Paynto.AI. All rights reserved.
          </div>
          <motion.div
            className="text-sm text-comfort-charcoal-500 flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
          >
            <span>Made with</span>
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ❤️
            </motion.span>
            <span>by AI + Humans</span>
          </motion.div>
        </div>
      </motion.div>
    </footer>
  )
}

