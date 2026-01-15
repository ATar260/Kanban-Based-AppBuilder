'use client'

import { ThemeProvider } from '@/components/landing/ThemeContext'
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import MockUI from '@/components/landing/MockUI'
import ProgressMetricsStrip from '@/components/landing/ProgressMetricsStrip'
import LowerKanbanSection from '@/components/landing/LowerKanbanSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import PricingSection from '@/components/landing/PricingSection'
import FAQSection from '@/components/landing/FAQSection'
import ContactForm from '@/components/landing/ContactForm'
import Footer from '@/components/landing/Footer'

export default function Home() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white antialiased overflow-x-hidden overflow-y-auto">
        {/* Fixed navbar at top */}
        <Navbar />
        <main>
          <Hero />
          <MockUI />
          <ProgressMetricsStrip />
          <LowerKanbanSection />
          <FeaturesSection />
          <PricingSection />
          <FAQSection />
          <ContactForm />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  )
}

