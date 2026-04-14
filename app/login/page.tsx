'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  PenLine, Mail, Lock, ArrowRight, Eye, EyeOff,
  CheckCircle2, Sparkles, Bot, FileText, Zap
} from 'lucide-react'
import toast from 'react-hot-toast'

const FEATURES = [
  { icon: FileText, title: 'Smart notes', desc: 'Rich-text editor with blocks, embeds & more' },
  { icon: Bot, title: 'AI Agent', desc: 'Ask AI to create, search & organise pages for you' },
  { icon: Zap, title: 'Instant sync', desc: 'Real-time updates across all your devices' },
  { icon: Sparkles, title: 'Beautiful UI', desc: 'Clean, distraction-free writing experience' },
]

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '6+ chars', ok: password.length >= 6 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ]
  if (!password) return null
  return (
    <div className="flex gap-2 mt-1.5">
      {checks.map(c => (
        <span key={c.label} className={`flex items-center gap-1 text-[10px] ${c.ok ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          <CheckCircle2 className={`w-2.5 h-2.5 ${c.ok ? 'opacity-100' : 'opacity-30'}`} />
          {c.label}
        </span>
      ))}
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  useEffect(() => { setMounted(true) }, [])

  const validate = useCallback(() => {
    const e: typeof errors = {}
    if (!email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email address'
    if (!password) e.password = 'Password is required'
    else if (password.length < 6) e.password = 'At least 6 characters required'
    setErrors(e)
    return Object.keys(e).length === 0
  }, [email, password])

  const handleGoogleSignIn = async () => {
    const supabase = createClient()
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      toast.error(error.message)
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const supabase = createClient()
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) throw error
        setSuccess(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
        router.refresh()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Fraunces, serif' }}>Check your inbox</h1>
          <p className="text-muted-foreground text-sm">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <button
            onClick={() => { setSuccess(false); setMode('signin') }}
            className="text-sm text-foreground font-medium hover:underline"
          >
            Back to sign in →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex" suppressHydrationWarning>

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] relative overflow-hidden bg-foreground text-background p-12">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5 z-10">
          <div className="w-7 h-7 rounded-lg bg-background/10 flex items-center justify-center">
            <PenLine className="w-4 h-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'Fraunces, serif' }}>Noted</span>
        </div>

        {/* Quote + features */}
        <div className="relative z-10 space-y-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-background/40 mb-4">Why Noted?</p>
            <blockquote className="text-[2rem] font-light leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>
              Your ideas deserve a workspace that thinks with you.
            </blockquote>
          </div>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-background/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-background/50">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom bar */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex -space-x-2">
            {['#6366f1', '#ec4899', '#f59e0b'].map((c, i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-foreground" style={{ background: c }} />
            ))}
          </div>
          <p className="text-xs text-background/50">Join thousands of thinkers already using Noted</p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        {/* Mobile logo */}
        <div className="absolute top-6 left-6 flex items-center gap-2 lg:hidden">
          <PenLine className="w-5 h-5" />
          <span className="font-semibold text-sm" style={{ fontFamily: 'Fraunces, serif' }}>Noted</span>
        </div>

        <div className="w-full max-w-[360px] animate-fade-in">

          {/* Mode toggle tabs */}
          <div className="flex bg-muted rounded-xl p-1 mb-8">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                id={`tab-${m}`}
                onClick={() => { setMode(m); setErrors({}) }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  mode === m
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <h1 className="text-2xl font-semibold mb-1">
            {mode === 'signin' ? 'Welcome back 👋' : 'Create your account'}
          </h1>
          <p className="text-muted-foreground text-sm mb-7">
            {mode === 'signin'
              ? 'Enter your details to access your workspace.'
              : 'Get started for free — no credit card needed.'}
          </p>

          {/* Google */}
          <button
            id="google-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full group flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-border bg-background text-sm font-medium hover:bg-accent active:scale-[0.98] disabled:opacity-60 transition-all duration-150 mb-5"
          >
            {googleLoading ? (
              <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-[11px] text-muted-foreground">or with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            {/* Email */}
            <div>
              <div className={`relative flex items-center rounded-xl border bg-background transition-colors ${errors.email ? 'border-destructive' : 'border-input focus-within:border-ring'}`}>
                <Mail className="absolute left-3.5 w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  id="email"
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
                  className="w-full bg-transparent pl-10 pr-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              {errors.email && <p className="text-xs text-destructive mt-1 ml-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <div className={`relative flex items-center rounded-xl border bg-background transition-colors ${errors.password ? 'border-destructive' : 'border-input focus-within:border-ring'}`}>
                <Lock className="absolute left-3.5 w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
                  minLength={6}
                  className="w-full bg-transparent pl-10 pr-11 py-3 text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive mt-1 ml-1">{errors.password}</p>}
              {mode === 'signup' && <PasswordStrength password={password} />}
            </div>

            {/* Forgot password (sign in only) */}
            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={async () => {
                    if (!email) { toast.error('Enter your email first'); return }
                    const supabase = createClient()
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/auth/callback`,
                    })
                    if (error) toast.error(error.message)
                    else toast.success('Password reset link sent!')
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              id="submit-btn"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all duration-150 mt-1"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Terms */}
          {mode === 'signup' && (
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              By signing up you agree to our{' '}
              <span className="underline cursor-pointer hover:text-foreground">Terms</span> and{' '}
              <span className="underline cursor-pointer hover:text-foreground">Privacy Policy</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
