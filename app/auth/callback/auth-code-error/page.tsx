// app/auth/auth-code-error/page.tsx
export default function AuthCodeError() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="max-w-lg text-center p-6 bg-black/50 rounded">
          <h1 className="text-2xl font-semibold text-white mb-4">Sign-in failed</h1>
          <p className="text-gray-300">
            Something went wrong during sign-in. Try again or contact support.
          </p>
          <div className="mt-4">
            <a href="/auth/login" className="text-blue-400">
              Return to login
            </a>
          </div>
        </div>
      </div>
    );
  }
  