import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { canOpenPortal, getSessionRole, type ManHubRole } from "@manhub/backend";

export type AuthState = {
  allowed: boolean;
  loading: boolean;
  role: ManHubRole | null;
  user: User | null;
};

export function usePortalAuth(supabase: SupabaseClient | null, portalRole: ManHubRole): AuthState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    allowed: false,
    loading: true,
    role: null,
    user: null,
  });

  const refresh = useCallback(async () => {
    if (!supabase) {
      setState({ allowed: false, loading: false, role: null, user: null });
      return;
    }

    const [{ data }, role] = await Promise.all([
      supabase.auth.getUser(),
      getSessionRole(supabase),
    ]);

    setState({
      allowed: canOpenPortal(role, portalRole),
      loading: false,
      role,
      user: data.user,
    });
  }, [portalRole, supabase]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void refresh());
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  return { ...state, refresh };
}

export async function signInWithPassword(supabase: SupabaseClient, email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(supabase: SupabaseClient) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
