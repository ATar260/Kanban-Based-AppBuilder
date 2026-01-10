'use client'

import { motion } from 'framer-motion'

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
      gradient: "from-gray-100 to-gray-50"
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
      gradient: "from-emerald-50 to-white"
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
      gradient: "from-gray-100 to-gray-50"
    }
  ]

  return (
    <section id="pricing" className="py-12 md:py-16 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center px-3 py-1.5 mb-4 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-full border border-emerald-300">
            Pricing
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-gray-900 tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your needs. Start free and scale as you grow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className={`relative bg-gradient-to-b ${plan.gradient} rounded-2xl border-2 overflow-hidden ${
                plan.popular
                  ? 'border-emerald-500 shadow-xl shadow-emerald-500/10'
                  : 'border-gray-200 hover:border-emerald-300'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0">
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-center py-2 text-sm font-medium">
                    Most Popular
                  </div>
                </div>
              )}

              <div className={`p-6 ${plan.popular ? 'pt-12' : ''}`}>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-500 text-sm mb-4">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  {plan.period && (
                    <span className="text-gray-500 ml-1">{plan.period}</span>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start text-sm">
                      <svg
                        className={`w-5 h-5 mr-3 flex-shrink-0 ${plan.popular ? 'text-emerald-500' : 'text-gray-400'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGetStarted}
                  className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl hover:shadow-emerald-500/25'
                      : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  {plan.cta}
                </motion.button>
              </div>
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
          <p className="text-gray-500 text-sm">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
