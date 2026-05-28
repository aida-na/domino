"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { X } from "lucide-react"
import { motion } from "framer-motion"

function WaitlistModalInner({ onClose }: { onClose: () => void }) {
  const searchParams = useSearchParams()
  const refCode = searchParams.get("ref") ?? ""
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [error, setError] = useState("")

  void refCode; // ref code available for future use

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setStatus("loading")
    try {
      const res = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || "something went wrong")
      setStatus("success")
      setEmail("")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "something went wrong")
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />

      <motion.div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-t-3xl sm:rounded-2xl shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
      >
        {/* Colored header block */}
        <div className="relative bg-primary px-6 pt-5 pb-5 overflow-hidden">
          {/* Decorative blobs */}
          <div className="absolute -top-8 -right-8 size-40 rounded-full bg-white/10" />
          <div className="absolute top-12 -right-4 size-24 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 left-8 size-28 rounded-full bg-white/10" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <X className="size-4" />
          </button>

          {status === "success" ? (
            <div className="py-6">
              <p className="font-compagnon text-4xl font-black leading-none text-white lowercase">
                you&apos;re<br />on the list!
              </p>
              <p className="mt-3 text-sm text-white/70">we&apos;ll be in touch soon.</p>
            </div>
          ) : (
            <h2 className="font-compagnon text-[2.25rem] font-black leading-[0.92] text-white lowercase">
              join the<br />*waitlist
            </h2>
          )}

        </div>

        {/* White form area */}
        <div className="bg-background px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
          {status !== "success" && (
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 pl-4 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
                <input
                  type="email"
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  inputMode="email"
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="shrink-0 rounded-full bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wide text-background transition-opacity hover:opacity-80 disabled:opacity-50 min-h-[36px] touch-manipulation"
                >
                  {status === "loading" ? "…" : "join"}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-destructive px-1">{error}</p>}
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export function WaitlistModal({ onClose }: { onClose: () => void }) {
  return (
    <Suspense fallback={null}>
      <WaitlistModalInner onClose={onClose} />
    </Suspense>
  )
}
