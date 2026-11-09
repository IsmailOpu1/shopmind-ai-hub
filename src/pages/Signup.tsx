import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import AuthShell from "@/components/auth/AuthShell";
import PasswordInput from "@/components/auth/PasswordInput";

const MIN_PASSWORD = 6;

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signUp(email.trim(), password, businessName);
      toast({ title: "Account created!", description: "Check your email to verify your account, then log in." });
      navigate("/login");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your assistant" subtitle="Set up your store's AI sales assistant in minutes.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="businessName" className="text-slate-300">
            Store name
          </Label>
          <Input
            id="businessName"
            autoComplete="organization"
            placeholder="e.g. Dhaka Threads"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
            maxLength={100}
            className="auth-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-300">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="auth-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-300">
            Password
          </Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD}
            aria-describedby="password-hint"
            className="auth-input"
          />
          <p id="password-hint" className="text-xs text-slate-500">
            Use at least {MIN_PASSWORD} characters. A longer passphrase is safer.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <Button type="submit" className="btn-glow h-11 w-full text-base" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...
            </>
          ) : (
            <>
              Create account <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-center text-xs text-slate-500">
          By creating an account you agree to how we handle data in our{" "}
          <Link to="/privacy" className="text-slate-300 underline-offset-2 hover:underline">
            privacy policy
          </Link>
          .
        </p>

        <p className="text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-blue-400 hover:text-blue-300">
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default Signup;
