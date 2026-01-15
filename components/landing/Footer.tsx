'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

const socialLinks = [
  {
    name: 'Twitter',
    href: 'https://twitter.com/payntoai',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    name: 'GitHub',
    href: 'https://github.com/payntoai',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
      </svg>
    ),
  },
  {
    name: 'Discord',
    href: 'https://discord.gg/payntoai',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
  },
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/company/payntoai',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
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
                  className="w-10 h-10 rounded-xl bg-white border border-comfort-sage-200 flex items-center justify-center text-comfort-charcoal-600 hover:text-comfort-charcoal-800 hover:bg-comfort-sage-100 transition-colors"
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

