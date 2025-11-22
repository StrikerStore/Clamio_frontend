"use client"

import dynamic from "next/dynamic"
import { ClientOnly } from "@/components/auth/client-only"

const LoginForm = dynamic(() => import("@/components/auth/login-form").then(mod => ({ default: mod.LoginForm })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  )
})

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-24 h-24 flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Claimio Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Claimio</h1>
          <p className="text-gray-600 mt-2">Tap. Claim. Complete.</p>
        </div>
        <ClientOnly>
          <LoginForm />
        </ClientOnly>
      </div>
    </div>
  )
}
