import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  canOpenPortal,
  createManHubSupabaseClient,
  getLoginUrl,
  getPortalDestination,
  getSessionProfile,
  getUnauthorizedUrl,
  isProfileEnabled,
  routeAfterLogin,
  upsertCustomerProfile,
  type ManHubProfile,
  type ManHubRole,
} from "@manhub/backend";
import { Button, Card, EmptyState, FormField, PageHeader, PortalShell } from "@manhub/ui";

export type AuthState = {
  allowed: boolean;
  loading: boolean;
  profile: ManHubProfile | null;
  redirecting: boolean;
  role: ManHubRole | null;
  user: User | null;
};

export function usePortalAuth(supabase: SupabaseClient | null, portalRole: ManHubRole): AuthState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    allowed: false,
    loading: true,
    profile: null,
    redirecting: false,
    role: null,
    user: null,
  });

  const refresh = useCallback(async () => {
    if (!supabase) {
      setState({ allowed: false, loading: false, profile: null, redirecting: false, role: null, user: null });
      return;
    }

    const [{ data }, profile] = await Promise.all([
      supabase.auth.getUser(),
      getSessionProfile(supabase),
    ]);

    if (!data.user) {
      setState({ allowed: false, loading: false, profile: null, redirecting: true, role: null, user: null });
      window.location.replace(getLoginUrl(window.location.href));
      return;
    }

    if (!profile || !isProfileEnabled(profile)) {
      setState({ allowed: false, loading: false, profile, redirecting: true, role: profile?.role ?? null, user: data.user });
      window.location.replace(getUnauthorizedUrl(profile ? "inactive" : "missing-profile"));
      return;
    }

    const allowed = canOpenPortal(profile.role, portalRole);
    setState({
      allowed,
      loading: false,
      profile,
      redirecting: !allowed,
      role: profile.role,
      user: data.user,
    });

    if (!allowed) {
      window.location.replace(getUnauthorizedUrl("wrong-role"));
    }
  }, [portalRole, supabase]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void refresh());
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  return { ...state, refresh };
}

export function SingleSignOnPage() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"login" | "customer-register">("login");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Use your ManHub account. The platform will open the correct portal automatically.");

  useEffect(() => {
    if (!supabase) return;
    void routeAfterLogin(supabase).then(async (destination) => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        window.location.replace(destination);
      }
    });
  }, [supabase]);

  if (!supabase) {
    return <AuthShell><EmptyState text="Connect the shared Supabase project to enable ManHub sign-on." /></AuthShell>;
  }

  const submit = async () => {
    try {
      if (mode === "login") {
        await signInWithPassword(supabase, email, password);
        window.location.replace(await routeAfterLogin(supabase));
        return;
      }

      await registerCustomer(supabase, email, password, fullName);
      setStatus("Customer account created. If email confirmation is enabled, confirm your email before signing in.");
      window.location.replace(await routeAfterLogin(supabase));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to complete sign-on.");
    }
  };

  return (
    <AuthShell>
      <PageHeader title="ManHub Sign-On" />
      <Card tone="blue">
        <span className="mh-stat-label">Single Sign-On</span>
        <h2>{mode === "login" ? "Sign in once" : "Create customer account"}</h2>
        <p>{status}</p>
      </Card>
      <Card>
        <div className="mh-form-stack">
          {mode === "customer-register" && <FormField label="Full name" value={fullName} onChange={setFullName} />}
          <FormField label="Email" value={email} onChange={setEmail} type="email" />
          <FormField label="Password" value={password} onChange={setPassword} type="password" />
          <div className="mh-actions">
            <Button onClick={submit}>{mode === "login" ? "Sign in" : "Create customer account"}</Button>
            <Button tone="ghost" onClick={() => setMode(mode === "login" ? "customer-register" : "login")}>
              {mode === "login" ? "Register as customer" : "Back to sign in"}
            </Button>
          </div>
        </div>
        <p className="mh-muted-note">Supplier, workshop, and admin accounts are created by ManHub Admin after approval.</p>
      </Card>
    </AuthShell>
  );
}

export function UnauthorizedPage() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const [profile, setProfile] = useState<ManHubProfile | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void getSessionProfile(supabase).then(setProfile);
  }, [supabase]);

  const goHome = () => {
    if (profile?.role && isProfileEnabled(profile)) {
      window.location.assign(getPortalDestination(profile.role));
      return;
    }
    window.location.assign(getLoginUrl());
  };

  return (
    <AuthShell>
      <PageHeader title="Unauthorized" />
      <Card tone="amber">
        <h2>This portal is not available for your account.</h2>
        <p>ManHub checks your role from the profiles table and only opens the dashboard assigned to your account.</p>
        <div className="mh-actions">
          <Button onClick={goHome}>{profile?.role ? "Go to my portal" : "Back to sign in"}</Button>
          {supabase && <Button tone="ghost" onClick={() => void signOut(supabase).then(() => window.location.assign(getLoginUrl()))}>Sign out</Button>}
        </div>
      </Card>
    </AuthShell>
  );
}

export async function signInWithPassword(supabase: SupabaseClient, email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function registerCustomer(supabase: SupabaseClient, email: string, password: string, fullName: string) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, requested_role: "customer" } },
  });
  if (error) throw error;
  await upsertCustomerProfile(supabase, fullName);
}

export async function signOut(supabase: SupabaseClient) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <PortalShell eyebrow="ManHub" routes={[]} title="SSO">
      <section className="mh-auth-panel">{children}</section>
    </PortalShell>
  );
}
