"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Loader2 } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Button, Card, CardContent, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    const sb = getSupabaseBrowser();
    if (!sb) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Account created. If email confirmation is on, check your inbox, then sign in.");
        setMode("signin");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand)] text-white glow">
            <Zap size={22} fill="white" />
          </div>
          <h1 className="text-lg font-bold gradient-text">RTO Leads</h1>
          <p className="text-xs text-[var(--color-muted)]">D2C lead scraper & CRM</p>
        </div>

        <Card className="glow">
          <CardContent className="pt-6">
            {!configured ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-[var(--color-text-dim)]">
                  Running in <b>demo mode</b> with sample data — no login required.
                </p>
                <Link href="/">
                  <Button className="w-full">Enter dashboard</Button>
                </Link>
                <p className="text-xs text-[var(--color-muted)]">
                  Add Supabase keys to <code>.env.local</code> to enable real team login.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
                {msg && <p className="text-xs text-[var(--color-brand-2)]">{msg}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                >
                  {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
