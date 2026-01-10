'use client'

import { ThemeProvider } from '@/components/landing/ThemeContext'
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import MockUI from '@/components/landing/MockUI'
import AgentTypesSection from '@/components/landing/AgentTypesSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import MetricsSection from '@/components/landing/MetricsSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import PricingSection from '@/components/landing/PricingSection'
import FAQSection from '@/components/landing/FAQSection'
import ContactForm from '@/components/landing/ContactForm'
import BackedBySection from '@/components/landing/BackedBySection'
import Footer from '@/components/landing/Footer'

export default function Home() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-comfort-sage-50 antialiased overflow-x-hidden overflow-y-auto">
        {/* Fixed navbar at top */}
        <Navbar />
        <main>
          <Hero />
          <MockUI />
          <AgentTypesSection />
          <HowItWorksSection />
          <MetricsSection />
          <FeaturesSection />
          <PricingSection />
          <FAQSection />
          <ContactForm />
          <BackedBySection />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  )
}

