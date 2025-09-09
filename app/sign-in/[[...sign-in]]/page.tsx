import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">HIPAA GPT</h1>
          <p className="mt-2 text-gray-600">Medical AI Assistant</p>
        </div>
        <SignIn 
          forceRedirectUrl="/chat"
          signUpUrl="/sign-up"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-xl",
              headerTitle: "text-2xl",
              formButtonPrimary: "bg-blue-600 hover:bg-blue-700",
              footerAction: "text-gray-600",
            },
          }}
        />
      </div>
    </div>
  );
}