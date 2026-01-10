'use client'

import { motion } from 'framer-motion'
import { GlowingCard } from '@/components/ui/moving-border'

export default function PricingSection() {
  const handleGetStarted = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  const plans = [
    {
      name: "Starter",
      description: "Perfect for individuals and small projects",
      price: "Free",
      period: "",
      features: [
        "3 projects per month",
        "Basic AI agents",
        "Community support",
        "Public deployments",
        "Basic analytics"
      ],
      cta: "Get Started Free",
      popular: false,
    },
    {
      name: "Pro",
      description: "For professional developers and teams",
      price: "$29",
      period: "/month",
      features: [
        "Unlimited projects",
        "Advanced AI agents",
        "Priority support",
        "Private deployments",
        "Advanced analytics",
        "Custom domains",
        "Team collaboration"
      ],
      cta: "Start Pro Trial",
      popular: true,
    },
    {
      name: "Enterprise",
      description: "Custom solutions for large organizations",
      price: "Custom",
      period: "",
      features: [
        "Everything in Pro",
        "Dedicated AI instances",
        "24/7 premium support",
        "On-premise deployment",
        "Custom integrations",
        "SLA guarantees",
        "Security compliance"
      ],
      cta: "Contact Sales",
      popular: false,
    }
  ]

  return (
    <section id="pricing" className="py-20 md:py-28 bg-comfort-sage-100">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center px-5 py-2 mb-6 text-sm font-medium text-comfort-sage-700 bg-comfort-sage-100 rounded-full">
            Pricing
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5 text-comfort-charcoal-800 tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-comfort-charcoal-500 max-w-2xl mx-auto leading-relaxed">
            Choose the plan that fits your needs. Start free and scale as you grow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
            >
            <GlowingCard
              className={`relative rounded-[24px] overflow-hidden h-full ${
                plan.popular
                  ? 'shadow-xl shadow-comfort-sage-500/10 ring-2 ring-comfort-sage-400 animate-glow-pulse'
                  : 'shadow-lg shadow-comfort-charcoal-800/5'
              }`}
              glowColor={plan.popular ? "rgba(127, 181, 137, 0.4)" : "rgba(127, 181, 137, 0.2)"}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0">
                  <div className="bg-gradient-to-r from-comfort-sage-500 to-comfort-sage-600 text-white text-center py-2.5 text-sm font-medium">
                    Most Popular
                  </div>
                </div>
              )}

              <div className={`p-8 ${plan.popular ? 'pt-14' : ''}`}>
                <h3 className="text-xl font-bold text-comfort-charcoal-800 mb-2">{plan.name}</h3>
                <p className="text-comfort-charcoal-400 text-sm mb-6">{plan.description}</p>

                <div className="mb-8">
                  <span className="text-4xl font-bold text-comfort-charcoal-800">{plan.price}</span>
                  {plan.period && (
                    <span className="text-comfort-charcoal-400 ml-1">{plan.period}</span>
                  )}
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start text-sm">
                      <svg
                        className={`w-5 h-5 mr-3 flex-shrink-0 ${plan.popular ? 'text-comfort-sage-500' : 'text-comfort-charcoal-300'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-comfort-charcoal-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGetStarted}
                  className={`w-full py-4 px-6 rounded-[16px] font-semibold transition-all duration-300 ${
                    plan.popular
                      ? 'bg-comfort-sage-500 hover:bg-comfort-sage-600 text-white shadow-lg shadow-comfort-sage-500/25 hover:shadow-xl'
                      : 'bg-comfort-sage-100 hover:bg-comfort-sage-200 text-comfort-charcoal-700'
                  }`}
                >
                  {plan.cta}
                </motion.button>
              </div>
            </GlowingCard>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-comfort-charcoal-400 text-sm">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
