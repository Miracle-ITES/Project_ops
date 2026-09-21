"use client";

import { useState } from "react";
import type { SubmitEventHandler } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();

    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(
          "Too many failed attempts. Please wait a few minutes and try again."
        );
      } else {
        setError("Incorrect email or password.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf8ff] text-[#131b2e]">
      <div className="min-h-screen flex flex-col lg:flex-row">

        {/* ================= LEFT BRAND PANEL ================= */}


        <section className="relative w-full lg:w-[48%] xl:w-[46%] overflow-hidden bg-[#064e3b] p-8 sm:p-12 lg:p-14 text-white flex flex-col justify-between">

          {/* Background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.035]"
            style={{
              backgroundImage:
                "radial-gradient(#34d399 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#10b981]/15 blur-3xl pointer-events-none" />

          <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[#2dd4bf]/10 blur-3xl pointer-events-none" />

          {/* ================= BRAND ================= */}

          <div className="relative z-10">
            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#34d399]/20 bg-[#033729] shadow-lg">
                <span className="text-lg font-bold text-emerald-300">
                  PO
                </span>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-bold tracking-tight">
                    Project Ops
                  </span>

                  <span className="rounded border border-[#34d399]/30 bg-[#003527] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6ee7b7]">
                    Platform
                  </span>
                </div>

                <span className="text-xs tracking-wide text-emerald-200/70">
                  Team & Project Operations
                </span>
              </div>

            </div>
          </div>

          {/* ================= HERO ================= */}

          <div className="relative z-10 my-8 space-y-8">

           

            {/* Heading */}
            <h1 className="max-w-xl text-2xl font-bold leading-[1.15] tracking-tight sm:text-4xl lg:text-[38px]">
              Run projects. Align teams. Move faster.
            </h1>

            {/* Description */}
            <p className="max-w-lg text-sm leading-relaxed text-emerald-100/80 sm:text-[15px]">
              Bring projects, tasks, teams, blockers, and operational insights
              together in one unified workspace built for modern teams.
            </p>

            {/* ================= OPERATIONS CARD ================= */}

            <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-[#033729]/80 p-4 shadow-xl backdrop-blur-md sm:p-5">

              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-emerald-500/15 pb-3">

                <div className="flex items-center gap-2">

                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                    ✓
                  </span>

                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-100">
                    Operations Overview
                  </span>

                </div>

                <span className="rounded border border-emerald-500/20 bg-emerald-900/50 px-2 py-0.5 font-mono text-[11px] text-[#a7f3d0]">
                  LIVE
                </span>

              </div>

              {/* Project Stats */}
              <div className="grid grid-cols-3 gap-3">

                {/* Projects */}
                <div className="rounded-lg border border-emerald-400/10 bg-[#064e3b]/60 p-2.5">
                  <div className="text-xs text-emerald-200/70">
                    Projects
                  </div>

                  <div className="mt-0.5 text-sm font-bold">
                    Active
                  </div>

                  <div className="mt-0.5 text-[10px] text-emerald-300">
                    ✓ Organized
                  </div>
                </div>

                {/* Tasks */}
                <div className="rounded-lg border border-emerald-400/10 bg-[#064e3b]/60 p-2.5">
                  <div className="text-xs text-emerald-200/70">
                    Tasks
                  </div>

                  <div className="mt-0.5 text-sm font-bold">
                    Tracked
                  </div>

                  <div className="mt-0.5 text-[10px] text-emerald-300">
                    ✓ Prioritized
                  </div>
                </div>

                {/* Team */}
                <div className="rounded-lg border border-emerald-400/10 bg-[#064e3b]/60 p-2.5">
                  <div className="text-xs text-emerald-200/70">
                    Teams
                  </div>

                  <div className="mt-0.5 text-sm font-bold">
                    Aligned
                  </div>

                  <div className="mt-0.5 text-[10px] text-emerald-300">
                    ✓ Connected
                  </div>
                </div>

              </div>

              

              {/* Bottom AI line */}
              <div className="flex items-center justify-between border-t border-emerald-500/10 pt-3 text-[11px]">

                <span className="text-emerald-200/70">
                  AI-powered operational insights
                </span>

                <span className="font-medium text-emerald-300">
                  Ask Project Ops AI →
                </span>

              </div>

            </div>

          </div>

          {/* ================= FOOTER ================= */}

          <div className="relative z-10 flex items-center justify-between text-[11px] text-emerald-200/50">
            <span>
              Built for modern teams
            </span>

            <span>
              Project visibility. Team alignment. Execution.
            </span>
          </div>

        </section>

        {/* ================= RIGHT LOGIN PANEL ================= */}

        <section className="flex w-full flex-1 flex-col justify-between overflow-y-auto bg-white p-6 sm:p-10 lg:w-[52%] lg:p-12 xl:w-[54%]">

          <div className="my-auto w-full max-w-lg mx-auto py-4">

            {/* Header */}
            <div className="mb-6">

              <h2 className="text-2xl font-bold tracking-tight text-[#131b2e] sm:text-3xl">
                Sign in to Project Ops
              </h2>

              <p className="mt-1 text-sm text-[#404944]">
                Enter your corporate credentials to access your internal
                operations workspace.
              </p>

            </div>

            {/* Login Form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="space-y-1">

                <label
                  htmlFor="email"
                  className="block text-xs font-semibold tracking-tight text-[#131b2e]"
                >
                  Work Email Address
                </label>

                <div className="relative">


                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="alex.chen@company.com"
                    className="h-10 w-full rounded-lg border border-[#dae2fd] bg-white pl-2 pr-3 text-sm text-[#131b2e] outline-none transition-all placeholder:text-gray-400 focus:border-[#006c4a] focus:ring-1 focus:ring-[#006c4a] disabled:bg-gray-100"
                  />

                </div>


              </div>

              {/* Password */}
              <div className="space-y-1">

                <label
                  htmlFor="password"
                  className="block text-xs font-semibold tracking-tight text-[#131b2e]"
                >
                  Password
                </label>

                <div className="relative">



                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="••••••••"
                    className="h-10 w-full rounded-lg border border-[#dae2fd] bg-white pl-2 pr-10 text-sm text-[#131b2e] outline-none transition-all placeholder:text-gray-400 focus:border-[#006c4a] focus:ring-1 focus:ring-[#006c4a] disabled:bg-gray-100"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-700"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "◉" : "◌"}
                  </button>

                </div>

              </div>

              {/* Remember / Forgot */}
              <div className="flex items-center justify-between pt-1">

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded accent-[#064e3b] focus:ring-[#006c4a]"
                  />

                  <span className="select-none text-xs text-[#404944]">
                    Remember this device
                  </span>
                </label>

                <a
                  href="#"
                  className="text-xs font-semibold text-[#006c4a] hover:underline"
                >
                  Forgot password?
                </a>

              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#064e3b] px-4 text-sm font-semibold tracking-wide text-white shadow-sm transition-all hover:bg-[#059669] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Signing in..." : "Sign In to Workspace"}

                {!isSubmitting && (
                  <span className="text-lg">
                    →
                  </span>
                )}
              </button>

            </form>


            {/* Help */}
            <div className="mt-5 text-center">

              <p className="text-xs text-[#404944]">
                Need access or experiencing issues?

                <a
                  href="#"
                  className="ml-1 inline-flex items-center gap-0.5 font-semibold text-[#006c4a] hover:underline"
                >
                  Contact IT Operations / Help Desk
                  <span>↗</span>
                </a>
              </p>

            </div>


          </div>
        </section>

      </div>
    </main>
  );
}