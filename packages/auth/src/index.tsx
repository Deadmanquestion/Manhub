import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  canShareManHubSession,
  canOpenPortal,
  createManFixSessionHandoffUrl,
  createManHubSupabaseClient,
  getAuthAppUrl,
  getLoginUrl,
  getPortalDestination,
  getPortalRoleForUrl,
  getSessionProfile,
  getUnauthorizedUrl,
  isProfileEnabled,
  readManFixSessionHandoff,
  removeManFixSessionHandoff,
  routeAfterLogin,
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

    const handoff = readManFixSessionHandoff(window.location.href);
    if (handoff) {
      const cleanUrl = removeManFixSessionHandoff(window.location.href);
      window.history.replaceState(window.history.state, "", cleanUrl);

      if (getPortalRoleForUrl(cleanUrl) !== portalRole) {
        setState({ allowed: false, loading: false, profile: null, redirecting: true, role: null, user: null });
        window.location.replace(getUnauthorizedUrl("wrong-role"));
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: handoff.accessToken,
        refresh_token: handoff.refreshToken,
      });

      if (error) {
        setState({ allowed: false, loading: false, profile: null, redirecting: true, role: null, user: null });
        window.location.replace(getLoginUrl(cleanUrl));
        return;
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setState({ allowed: false, loading: false, profile: null, redirecting: true, role: null, user: null });
      window.location.replace(getLoginUrl(window.location.href));
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
  const nextUrl = useMemo(() => new URLSearchParams(window.location.search).get("next"), []);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"login" | "customer-register">("login");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Use your ManFix account. The platform will open the correct portal automatically.");

  useEffect(() => {
    if (!supabase) return;
    void routeAfterLogin(supabase, nextUrl).then(async (destination) => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await openPortal(supabase, destination);
      }
    }).catch((error) => {
      setStatus(error instanceof Error ? error.message : "Unable to open your ManFix portal.");
    });
  }, [nextUrl, supabase]);

  if (!supabase) {
    return <AuthShell><EmptyState text="Connect the shared Supabase project to enable ManFix sign-on." /></AuthShell>;
  }

  const submit = async () => {
    try {
      if (mode === "login") {
        await signInWithPassword(supabase, email, password);
        const destination = await routeAfterLogin(supabase, nextUrl);
        setStatus("Sign-in succeeded. Opening your ManFix dashboard...");
        await openPortal(supabase, destination);
        return;
      }

      const signedIn = await registerCustomer(supabase, email, password, fullName);
      setStatus("Customer account created. If email confirmation is enabled, confirm your email before signing in.");
      if (signedIn) {
        const destination = await routeAfterLogin(supabase, nextUrl);
        setStatus("Account created. Opening your ManFix dashboard...");
        await openPortal(supabase, destination);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to complete sign-on.");
    }
  };

  return (
    <AuthShell>
      <PageHeader title="ManFix Sign-On" />
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
        <p className="mh-muted-note">Supplier, workshop, and admin accounts are created by ManFix Admin after approval.</p>
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

  const goHome = async () => {
    if (profile?.role && isProfileEnabled(profile)) {
      if (!supabase) return;
      await openPortal(supabase, getPortalDestination(profile.role));
      return;
    }
    window.location.assign(getLoginUrl());
  };

  return (
    <AuthShell>
      <PageHeader title="Unauthorized" />
      <Card tone="amber">
        <h2>This portal is not available for your account.</h2>
        <p>ManFix checks your role from the profiles table and only opens the dashboard assigned to your account.</p>
        <div className="mh-actions">
          <Button onClick={() => void goHome()}>{profile?.role ? "Go to my portal" : "Back to sign in"}</Button>
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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, requested_role: "customer" },
      emailRedirectTo: new URL("/login", getAuthAppUrl()).toString(),
    },
  });
  if (error) throw error;
  return data.session !== null;
}

export async function signOut(supabase: SupabaseClient) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function openPortal(supabase: SupabaseClient, destination: string) {
  if (canShareManHubSession(window.location.href, destination)) {
    window.location.replace(destination);
    return;
  }

  if (!getPortalRoleForUrl(destination)) {
    throw new Error("Your assigned ManFix portal is not available yet.");
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw error ?? new Error("Your sign-in session could not be transferred.");
  }

  window.location.replace(createManFixSessionHandoffUrl(
    destination,
    data.session.access_token,
    data.session.refresh_token,
  ));
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <PortalShell eyebrow="ManFix" routes={[]} title="SSO">
      <section className="mh-auth-panel">{children}</section>
    </PortalShell>
  );
}
