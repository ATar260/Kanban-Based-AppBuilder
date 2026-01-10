import Link from 'next/link'

export default function PrivacyPage() {
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

        <h1 className="text-4xl font-bold text-comfort-charcoal-800 mb-8">Privacy Policy</h1>

        <div className="prose prose-lg text-comfort-charcoal-600 space-y-6">
          <p className="text-sm text-comfort-charcoal-500">Last updated: January 2026</p>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">1. Information We Collect</h2>
            <p>
              We collect information you provide directly, including your name, email address,
              company information, and any content you create using our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Provide and improve our services</li>
              <li>Communicate with you about your account and updates</li>
              <li>Process transactions and send related information</li>
              <li>Respond to your requests and support needs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">3. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information.
              However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">4. Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to
              provide services. You can request deletion of your data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">5. Third-Party Services</h2>
            <p>
              We may use third-party services for analytics, payment processing, and other functions.
              These services have their own privacy policies governing the use of your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">6. Cookies</h2>
            <p>
              We use cookies and similar technologies to enhance your experience, analyze usage,
              and assist in our marketing efforts. You can control cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Access your personal information</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of marketing communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-comfort-charcoal-800 mt-8 mb-4">8. Contact Us</h2>
            <p>
              For privacy-related questions or requests, please contact us through our{' '}
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
