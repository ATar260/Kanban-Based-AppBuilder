'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

const navLinks = [
  { href: '#demo', label: 'Demo' },
  { href: '#agents', label: 'Agents' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
]

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault()
      const element = document.querySelector(href)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
        setIsMobileMenuOpen(false)
      }
    }
  }

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-4 left-4 right-4 z-50"
      >
        <nav
          className={`max-w-5xl mx-auto px-5 sm:px-6 lg:px-8 rounded-xl transition-all duration-300 ${isScrolled
            ? 'bg-white/80 backdrop-blur-md shadow-xl shadow-black/10 border border-comfort-sage-300'
            : 'bg-transparent'
            }`}
        >
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 flex-shrink-0">
              <Image
                src="/paynto-logo.png"
                alt="Paynto.AI Logo"
                width={44}
                height={44}
                className="w-10 h-10 md:w-11 md:h-11 rounded-[14px]"
              />
              <span className="text-xl md:text-2xl font-bold text-comfort-charcoal-800">
                Paynto<span className="text-comfort-sage-600">.</span>AI
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="px-4 py-2 text-sm font-medium text-comfort-charcoal-500 hover:text-comfort-charcoal-800 hover:bg-comfort-sage-200/50 rounded-[12px] transition-all"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href="/sign-in"
                className="hidden sm:block px-4 py-2 text-sm font-medium text-comfort-charcoal-600 hover:text-comfort-charcoal-800 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/generation"
                className="px-5 py-2.5 text-sm font-medium text-white bg-comfort-sage-500 hover:bg-comfort-sage-600 rounded-[14px] transition-all shadow-md shadow-comfort-sage-500/20 hover:shadow-lg hover:shadow-comfort-sage-500/25"
              >
                Get Started
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2.5 text-comfort-charcoal-600 hover:text-comfort-charcoal-800 hover:bg-comfort-sage-200/50 rounded-[12px] transition-all"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </nav>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-[72px] md:top-20 z-40 lg:hidden"
          >
            <div className="bg-comfort-sage-50 shadow-lg shadow-comfort-charcoal-800/5 mx-4 rounded-[20px] overflow-hidden">
              <div className="p-4 space-y-1">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="block px-4 py-3 text-base font-medium text-comfort-charcoal-600 hover:text-comfort-sage-700 hover:bg-comfort-sage-50 rounded-[12px] transition-all"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="pt-2 mt-2 border-t border-comfort-sage-300">
                  <Link
                    href="/sign-in"
                    className="block px-4 py-3 text-base font-medium text-comfort-charcoal-600 hover:text-comfort-sage-700 hover:bg-comfort-sage-50 rounded-[12px] transition-all"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
