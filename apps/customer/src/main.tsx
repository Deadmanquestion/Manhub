import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { EmptyState, MobileShell } from "@manhub/ui";
import { createManHubSupabaseClient, getLogoutUrl } from "@manhub/backend";
import { openPortalSelector, signOut, usePortalAuth } from "@manhub/auth";
import { useMemo } from "react";
import InvestorCustomerApp from "./InvestorCustomerApp";

function CustomerApp() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview")) {
    return <InvestorCustomerApp onSignOut={async () => undefined} />;
  }

  return <ProtectedCustomerApp />;
}

function ProtectedCustomerApp() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const auth = usePortalAuth(supabase, "customer");

  if (!supabase) return <MobileShell><EmptyState text="Connect the shared Supabase project to run the Customer App." /></MobileShell>;
  if (auth.loading || auth.redirecting) return <MobileShell><EmptyState text={auth.redirecting ? "Redirecting to secure sign-in..." : "Checking customer session..."} /></MobileShell>;
  if (!auth.allowed) return <MobileShell><EmptyState text="Customer role required. Redirecting to Unauthorized." /></MobileShell>;

  return (
    <InvestorCustomerApp
      onSwitchPortal={async () => openPortalSelector(supabase)}
      onSignOut={async () => {
        await signOut(supabase);
        window.location.replace(getLogoutUrl());
      }}
    />
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><BrowserRouter><CustomerApp /></BrowserRouter></StrictMode>);
