"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="mb-4 text-4xl">✓</div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900">Account Created</h2>
            <p className="text-sm text-gray-500 mb-1">
              Confirmation email sent to <span className="font-medium text-gray-900">{email}</span>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Check your inbox and click the link to activate your account.
            </p>
            <Link href="/login">
              <button className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                Back to Login
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-blue-600 tracking-tight">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-gray-500">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
              />
              <p className="text-xs text-gray-400">Minimum 6 characters</p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <p className="text-center text-sm text-gray-500">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          Secure · Encrypted · Enterprise-Grade
        </div>
      </div>
    </div>
  );
}
