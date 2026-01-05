"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import Link from "next/link";
import Button from "@/components/ui/shadcn/button";

const isAuthEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

function useOptionalSession() {
  try {
    const session = useSession();
    return session || { data: null, status: 'unauthenticated' as const };
  } catch {
    return { data: null, status: 'unauthenticated' as const };
  }
}

function LoginContent() {
  const { data: session, status } = useOptionalSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/generation";
  const error = searchParams.get("error");

  useEffect(() => {
    if (!isAuthEnabled) {
      router.push("/generation");
      return;
    }
    if (session) {
      router.push(callbackUrl);
    }
  }, [session, router, callbackUrl]);

  if (!isAuthEnabled) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-border-faint rounded-16 shadow-2xl p-24 text-center">
          <h1 className="text-title-h5 font-semibold text-accent-black mb-6">Authentication disabled</h1>
          <p className="text-body-medium text-black-alpha-72 mb-16">
            Authentication is not configured for this environment.
          </p>
          <Link href="/generation" className="inline-flex">
            <Button variant="primary" size="large">Go to app</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-border-faint rounded-16 shadow-2xl p-24">
          <div className="text-center mb-16">
            <h1 className="text-title-h5 font-semibold text-accent-black mb-4">Welcome to Paynto A.I.</h1>
            <p className="text-body-medium text-black-alpha-72">
              Sign in to save projects and sync to GitHub.
            </p>
          </div>

          {error && (
            <div className="mb-16 p-12 bg-red-50 border border-red-200 rounded-12">
              <p className="text-sm text-red-700">
                {error === "OAuthAccountNotLinked"
                  ? "This email is already associated with another account."
                  : "An error occurred during sign in. Please try again."}
              </p>
            </div>
          )}

          <Button
            onClick={() => signIn("github", { callbackUrl })}
            variant="primary"
            size="large"
            className="w-full"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </Button>

          <p className="mt-16 text-center text-xs text-black-alpha-56">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
