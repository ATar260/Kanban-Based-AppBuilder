import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-comfort-sage-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/"
          className="inline-flex items-center text-comfort-sage-600 hover:text-comfort-sage-700 mb-8"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold text-comfort-charcoal-800 mb-8">Terms of Service</h1>

        <div className="prose prose-lg text-comfort-charcoal-600 space-y-6">
          <p className="text-sm text-comfort-charcoal-500">Last updated: January 2026</p>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Paynto.AI, you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">2. Description of Service</h2>
            <p>
              Paynto.AI is an AI-powered application development platform that helps users create
              software applications through natural language interactions and a visual kanban-style interface.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">3. User Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account and for all
              activities that occur under your account. You agree to use the service only for lawful purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">4. Intellectual Property</h2>
            <p>
              Code generated through our platform belongs to you. However, the Paynto.AI platform,
              including its design, features, and underlying technology, remains our intellectual property.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">5. Limitation of Liability</h2>
            <p>
              Paynto.AI is provided &quot;as is&quot; without warranties of any kind. We are not liable for any
              damages arising from the use of our service, including but not limited to direct, indirect,
              incidental, or consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">6. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the service
              after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">7. Contact</h2>
            <p>
              For questions about these terms, please contact us through our{' '}
              <Link href="/#contact" className="text-comfort-sage-600 hover:text-comfort-sage-700 underline">
                contact form
              </Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
