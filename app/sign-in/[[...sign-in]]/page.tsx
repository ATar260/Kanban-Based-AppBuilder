import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-lg">
            <span className="text-xl font-bold text-white">P</span>
          </div>
          <span className="text-2xl font-bold text-gray-900">
            Paynto<span className="text-emerald-700">.</span>AI
          </span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
            <p className="text-gray-600">Sign in to continue building with AI</p>
          </div>

          <SignIn
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-white border border-gray-200 shadow-xl rounded-xl",
                headerTitle: "text-gray-900",
                headerSubtitle: "text-gray-600",
                socialButtonsBlockButton:
                  "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors",
                socialButtonsBlockButtonText: "text-gray-700 font-medium",
                dividerLine: "bg-gray-200",
                dividerText: "text-gray-500",
                formFieldLabel: "text-gray-700",
                formFieldInput:
                  "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-emerald-500 focus:border-emerald-500",
                formButtonPrimary:
                  "bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition-colors",
                footerActionLink: "text-emerald-700 hover:text-emerald-800",
                identityPreviewText: "text-gray-900",
                identityPreviewEditButton: "text-emerald-700",
                formFieldAction: "text-emerald-700",
                otpCodeFieldInput: "bg-white border-gray-200 text-gray-900",
              },
            }}
          />

          <p className="text-center text-gray-500 text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-emerald-700 hover:text-emerald-800 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-6 text-center text-gray-500 text-sm">
        &copy; {new Date().getFullYear()} Paynto A.I. All rights reserved.
      </footer>
    </div>
  );
}
