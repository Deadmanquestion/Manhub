import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  canShareManHubSession,
  canOpenPortal,
  createManFixSessionHandoffUrl,
  createManHubSupabaseClient,
  getAvailablePortalRoles,
  getAuthAppUrl,
  getLoginUrl,
  getPortalDestination,
  getPortalSelectorUrl,
  getPortalRoleForUrl,
  getSessionProfile,
  getSessionRoles,
  getUnauthorizedUrl,
  isAuthAppUrl,
  isProfileEnabled,
  portalLabelByRole,
  readManFixSessionHandoff,
  rememberPortal,
  removeManFixSessionHandoff,
  routeAfterLogin,
  submitPartnerApplication,
  uploadPartnerApplicationFiles,
  type ManHubProfile,
  type ManHubRole,
  type PartnerApplicationType,
  type PortalRole,
} from "@manhub/backend";
import { Button, Card, EmptyState, FileField, FormField, PageHeader, PortalShell, TextAreaField } from "@manhub/ui";

function getAuthPathUrl(path: string) {
  const url = new URL("/", getAuthAppUrl());
  url.hash = path.startsWith("/") ? path : `/${path}`;
  return url.toString();
}

function getPartnerApplicationsUrl() {
  return getAuthPathUrl("/partners");
}

function getAuthRouteParams() {
  const hashQueryStart = window.location.hash.indexOf("?");
  if (hashQueryStart >= 0) {
    return new URLSearchParams(window.location.hash.slice(hashQueryStart + 1));
  }
  return new URLSearchParams(window.location.search);
}

export type AuthState = {
  allowed: boolean;
  loading: boolean;
  profile: ManHubProfile | null;
  redirecting: boolean;
  role: ManHubRole | null;
  roles: ManHubRole[];
  user: User | null;
};

export function usePortalAuth(supabase: SupabaseClient | null, portalRole: PortalRole): AuthState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    allowed: false,
    loading: true,
    profile: null,
    redirecting: false,
    role: null,
    roles: [],
    user: null,
  });

  const refresh = useCallback(async () => {
    if (!supabase) {
      setState({ allowed: false, loading: false, profile: null, redirecting: false, role: null, roles: [], user: null });
      return;
    }

    const handoff = readManFixSessionHandoff(window.location.href);
    if (handoff) {
      const cleanUrl = removeManFixSessionHandoff(window.location.href);
      window.history.replaceState(window.history.state, "", cleanUrl);

      if (getPortalRoleForUrl(cleanUrl) !== portalRole) {
        setState({ allowed: false, loading: false, profile: null, redirecting: true, role: null, roles: [], user: null });
        window.location.replace(getUnauthorizedUrl("wrong-role"));
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: handoff.accessToken,
        refresh_token: handoff.refreshToken,
      });

      if (error) {
        setState({ allowed: false, loading: false, profile: null, redirecting: true, role: null, roles: [], user: null });
        window.location.replace(getLoginUrl(cleanUrl));
        return;
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setState({ allowed: false, loading: false, profile: null, redirecting: true, role: null, roles: [], user: null });
      window.location.replace(getLoginUrl(window.location.href));
      return;
    }

    const [{ data }, profile, roles] = await Promise.all([
      supabase.auth.getUser(),
      getSessionProfile(supabase),
      getSessionRoles(supabase),
    ]);

    if (!data.user) {
      setState({ allowed: false, loading: false, profile: null, redirecting: true, role: null, roles: [], user: null });
      window.location.replace(getLoginUrl(window.location.href));
      return;
    }

    if (!profile || !isProfileEnabled(profile)) {
      setState({ allowed: false, loading: false, profile, redirecting: true, role: profile?.role ?? null, roles, user: data.user });
      window.location.replace(getUnauthorizedUrl(profile ? "inactive" : "missing-profile"));
      return;
    }

    const allowed = canOpenPortal(roles, portalRole);
    setState({
      allowed,
      loading: false,
      profile,
      redirecting: !allowed,
      role: profile.role,
      roles,
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
  const nextUrl = useMemo(() => getAuthRouteParams().get("next"), []);
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
              {mode === "login" ? "Create customer account" : "Back to sign in"}
            </Button>
            {mode === "login" && (
              <Button tone="ghost" onClick={() => window.location.assign(getPartnerApplicationsUrl())}>
                Become a ManFix Partner
              </Button>
            )}
          </div>
        </div>
        <p className="mh-muted-note">
          Supplier, workshop, and technician accounts are created only after ManFix Admin approval.
        </p>
      </Card>
    </AuthShell>
  );
}

export function PortalSelectionPage() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const [profile, setProfile] = useState<ManHubProfile | null>(null);
  const [roles, setRoles] = useState<ManHubRole[]>([]);
  const [busyRole, setBusyRole] = useState<PortalRole | null>(null);
  const [status, setStatus] = useState("Checking the portals assigned to your account...");

  useEffect(() => {
    if (!supabase) return;

    const load = async () => {
      const handoff = readManFixSessionHandoff(window.location.href);
      if (handoff) {
        const cleanUrl = removeManFixSessionHandoff(window.location.href);
        window.history.replaceState(window.history.state, "", cleanUrl);
        if (!isAuthAppUrl(cleanUrl)) throw new Error("The portal switch request is not trusted.");

        const { error } = await supabase.auth.setSession({
          access_token: handoff.accessToken,
          refresh_token: handoff.refreshToken,
        });
        if (error) throw error;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.replace(getLoginUrl());
        return;
      }

      const [loadedProfile, loadedRoles] = await Promise.all([
        getSessionProfile(supabase),
        getSessionRoles(supabase),
      ]);
      if (!loadedProfile || !isProfileEnabled(loadedProfile)) {
        window.location.replace(getUnauthorizedUrl(loadedProfile ? "inactive" : "missing-profile"));
        return;
      }

      const available = getAvailablePortalRoles(loadedRoles);
      if (available.length === 0) {
        window.location.replace(getUnauthorizedUrl("missing-role"));
        return;
      }
      if (available.length === 1) {
        await rememberPortal(supabase, available[0]);
        await openPortal(supabase, getPortalDestination(available[0]));
        return;
      }

      setProfile(loadedProfile);
      setRoles(loadedRoles);
      setStatus("Choose where you want to work. You can switch again from your profile.");
    };

    void load().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Unable to load your assigned portals.");
    });
  }, [supabase]);

  if (!supabase) {
    return <AuthShell><EmptyState text="Connect the shared Supabase project to choose a portal." /></AuthShell>;
  }

  const availablePortals = getAvailablePortalRoles(roles);
  const locallyRemembered = window.localStorage.getItem("manfix-last-portal");
  const lastPortal = profile?.last_portal_role
    ?? (availablePortals.find((role) => role === locallyRemembered) ?? null);
  const orderedPortals = [...availablePortals].sort((left, right) => {
    if (left === lastPortal) return -1;
    if (right === lastPortal) return 1;
    return portalLabelByRole[left].localeCompare(portalLabelByRole[right]);
  });

  const choose = async (role: PortalRole) => {
    if (busyRole) return;
    setBusyRole(role);
    setStatus(`Opening ${portalLabelByRole[role]}...`);
    try {
      await rememberPortal(supabase, role);
      await openPortal(supabase, getPortalDestination(role));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to open that portal.");
      setBusyRole(null);
    }
  };

  return (
    <AuthShell>
      <PageHeader title="Select Portal">
        <Button tone="ghost" onClick={() => void signOut(supabase).then(() => window.location.replace(getLoginUrl()))}>
          Sign out
        </Button>
      </PageHeader>
      <Card tone="blue">
        <span className="mh-stat-label">{roles.includes("super_admin") ? "Super Admin Access" : "Multi-Role Account"}</span>
        <h2>{profile?.full_name ? `Welcome, ${profile.full_name}` : "Choose Portal"}</h2>
        <p>{status}</p>
      </Card>
      <div className="mh-partner-grid">
        {orderedPortals.map((role) => (
          <Card key={role}>
            <div className="mh-partner-card">
              <div>
                <span className="mh-stat-label">{role === lastPortal ? "Last used" : "Available"}</span>
                <h2 className="mh-card-title">{portalLabelByRole[role]}</h2>
                <p>{portalDescription(role)}</p>
              </div>
              <Button disabled={busyRole !== null} onClick={() => void choose(role)}>
                {busyRole === role ? "Opening..." : "Open portal"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </AuthShell>
  );
}

export function PartnerLandingPage() {
  const applications: Array<{
    description: string;
    label: string;
    path: string;
  }> = [
    {
      description: "List automotive products, manage stock, and receive supplier orders.",
      label: "Apply as Supplier",
      path: "/apply/supplier",
    },
    {
      description: "Join the service network and manage bookings, repairs, and technicians.",
      label: "Apply as Workshop",
      path: "/apply/workshop",
    },
    {
      description: "Submit your experience and certificates for technician approval.",
      label: "Apply as Technician",
      path: "/apply/technician",
    },
  ];

  return (
    <AuthShell>
      <PageHeader title="Become a ManFix Partner">
        <Button tone="ghost" onClick={() => window.location.assign(getLoginUrl())}>Back to sign in</Button>
      </PageHeader>
      <Card tone="blue">
        <span className="mh-stat-label">Partner Network</span>
        <h2>Apply first. Access follows approval.</h2>
        <p>Submitting an application does not create a portal account. ManFix Admin reviews every partner before issuing secure sign-in access.</p>
      </Card>
      <div className="mh-partner-grid">
        {applications.map((application) => (
          <Card key={application.path}>
            <div className="mh-partner-card">
              <div>
                <h2 className="mh-card-title">{application.label}</h2>
                <p>{application.description}</p>
              </div>
              <Button onClick={() => window.location.assign(getAuthPathUrl(application.path))}>Open application</Button>
            </div>
          </Card>
        ))}
      </div>
    </AuthShell>
  );
}

export function SupplierApplicationPage() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const [companyName, setCompanyName] = useState("");
  const [ssmNumber, setSsmNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [logo, setLogo] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const submission = usePartnerSubmission("supplier");

  const submit = async () => {
    if (!supabase) return;
    await submission.run(async (id) => {
      requireFields([
        ["Company name", companyName],
        ["SSM registration number", ssmNumber],
        ["Contact person", contactPerson],
        ["Email", email],
        ["Phone", phone],
        ["Business address", address],
        ["Business category", category],
      ]);
      requireFiles("Company logo", logo);
      requireFiles("Supporting documents", documents);

      const [logoPaths, documentPaths] = await Promise.all([
        uploadPartnerApplicationFiles(supabase, "supplier", id, "logo", logo),
        uploadPartnerApplicationFiles(supabase, "supplier", id, "document", documents),
      ]);

      await submitPartnerApplication(supabase, "supplier", {
        bank_account: bankAccount.trim() || null,
        business_address: address.trim(),
        business_category: category.trim(),
        company_logo_path: logoPaths[0],
        company_name: companyName.trim(),
        contact_person: contactPerson.trim(),
        email: email.trim().toLowerCase(),
        id,
        phone: phone.trim(),
        ssm_registration_number: ssmNumber.trim(),
        supporting_document_paths: documentPaths,
      });
    });
  };

  return (
    <PartnerApplicationShell
      busy={submission.busy}
      status={submission.status}
      submittedId={submission.submittedId}
      title="Supplier Application"
      onSubmit={submit}
    >
      <div className="mh-grid-2">
        <FormField label="Company Name" value={companyName} onChange={setCompanyName} />
        <FormField label="SSM Registration Number" value={ssmNumber} onChange={setSsmNumber} />
        <FormField label="Contact Person" value={contactPerson} onChange={setContactPerson} />
        <FormField label="Email" value={email} onChange={setEmail} type="email" />
        <FormField label="Phone" value={phone} onChange={setPhone} type="tel" />
        <FormField label="Business Category" value={category} onChange={setCategory} />
      </div>
      <TextAreaField label="Business Address" value={address} onChange={setAddress} />
      <FormField label="Bank Account (optional)" value={bankAccount} onChange={setBankAccount} />
      <div className="mh-grid-2">
        <FileField accept="image/jpeg,image/png,image/webp" label="Company Logo" onChange={setLogo} required />
        <FileField accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp" label="Supporting Documents" multiple onChange={setDocuments} required />
      </div>
    </PartnerApplicationShell>
  );
}

export function WorkshopApplicationPage() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const [workshopName, setWorkshopName] = useState("");
  const [ssmNumber, setSsmNumber] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hours, setHours] = useState("");
  const [brands, setBrands] = useState("");
  const [technicians, setTechnicians] = useState("");
  const [lifts, setLifts] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const submission = usePartnerSubmission("workshop");

  const submit = async () => {
    if (!supabase) return;
    await submission.run(async (id) => {
      requireFields([
        ["Workshop name", workshopName],
        ["SSM number", ssmNumber],
        ["Address", address],
        ["Phone", phone],
        ["Email", email],
        ["Operating hours", hours],
        ["Brands supported", brands],
        ["Number of technicians", technicians],
        ["Number of lifts", lifts],
      ]);
      requireFiles("Workshop photos", photos);

      const photoPaths = await uploadPartnerApplicationFiles(supabase, "workshop", id, "photo", photos);
      await submitPartnerApplication(supabase, "workshop", {
        address: address.trim(),
        brands_supported: splitList(brands),
        email: email.trim().toLowerCase(),
        id,
        number_of_lifts: parseWholeNumber("Number of lifts", lifts),
        number_of_technicians: parseWholeNumber("Number of technicians", technicians),
        operating_hours: hours.trim(),
        phone: phone.trim(),
        ssm_number: ssmNumber.trim(),
        workshop_name: workshopName.trim(),
        workshop_photo_paths: photoPaths,
      });
    });
  };

  return (
    <PartnerApplicationShell
      busy={submission.busy}
      status={submission.status}
      submittedId={submission.submittedId}
      title="Workshop Application"
      onSubmit={submit}
    >
      <div className="mh-grid-2">
        <FormField label="Workshop Name" value={workshopName} onChange={setWorkshopName} />
        <FormField label="SSM Number" value={ssmNumber} onChange={setSsmNumber} />
        <FormField label="Phone" value={phone} onChange={setPhone} type="tel" />
        <FormField label="Email" value={email} onChange={setEmail} type="email" />
        <FormField label="Operating Hours" value={hours} onChange={setHours} />
        <FormField label="Brands Supported (comma separated)" value={brands} onChange={setBrands} />
        <FormField label="Number of Technicians" value={technicians} onChange={setTechnicians} type="number" />
        <FormField label="Number of Lifts" value={lifts} onChange={setLifts} type="number" />
      </div>
      <TextAreaField label="Address" value={address} onChange={setAddress} />
      <FileField accept="image/jpeg,image/png,image/webp" label="Workshop Photos" multiple onChange={setPhotos} required />
    </PartnerApplicationShell>
  );
}

export function TechnicianApplicationPage() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [experience, setExperience] = useState("");
  const [employer, setEmployer] = useState("");
  const [resume, setResume] = useState<File[]>([]);
  const [certificates, setCertificates] = useState<File[]>([]);
  const submission = usePartnerSubmission("technician");

  const submit = async () => {
    if (!supabase) return;
    await submission.run(async (id) => {
      requireFields([
        ["Full name", fullName],
        ["Email", email],
        ["Phone", phone],
        ["Work experience", experience],
      ]);
      requireFiles("Resume", resume);
      requireFiles("Certificates", certificates);

      const [resumePaths, certificatePaths] = await Promise.all([
        uploadPartnerApplicationFiles(supabase, "technician", id, "resume", resume),
        uploadPartnerApplicationFiles(supabase, "technician", id, "certificate", certificates),
      ]);

      await submitPartnerApplication(supabase, "technician", {
        certificate_paths: certificatePaths,
        current_employer: employer.trim() || null,
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        id,
        phone: phone.trim(),
        resume_path: resumePaths[0],
        work_experience: experience.trim(),
      });
    });
  };

  return (
    <PartnerApplicationShell
      busy={submission.busy}
      status={submission.status}
      submittedId={submission.submittedId}
      title="Technician Application"
      onSubmit={submit}
    >
      <div className="mh-grid-2">
        <FormField label="Full Name" value={fullName} onChange={setFullName} />
        <FormField label="Email" value={email} onChange={setEmail} type="email" />
        <FormField label="Phone" value={phone} onChange={setPhone} type="tel" />
        <FormField label="Current Employer (optional)" value={employer} onChange={setEmployer} />
      </div>
      <TextAreaField label="Work Experience" value={experience} onChange={setExperience} rows={6} />
      <div className="mh-grid-2">
        <FileField accept=".pdf,.doc,.docx" label="Resume" onChange={setResume} required />
        <FileField accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp" label="Certificates" multiple onChange={setCertificates} required />
      </div>
    </PartnerApplicationShell>
  );
}

export function SetPasswordPage() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Checking your secure invitation...");

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setStatus("This invitation is invalid or has expired. Ask ManFix Admin to send a new invitation.");
        return;
      }
      setReady(true);
      setStatus("Create a password to activate your approved partner account.");
    });
  }, [supabase]);

  const save = async () => {
    if (!supabase || busy || !ready) return;
    if (password.length < 8) {
      setStatus("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmation) {
      setStatus("The password confirmation does not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus("Password saved. Opening your approved ManFix portal...");
      await openPortal(supabase, await routeAfterLogin(supabase));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save your password.");
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <PageHeader title="Activate Partner Account" />
      <Card tone="blue"><h2>Set your password</h2><p>{status}</p></Card>
      <Card>
        <div className="mh-form-stack">
          <FormField label="New Password" value={password} onChange={setPassword} type="password" />
          <FormField label="Confirm Password" value={confirmation} onChange={setConfirmation} type="password" />
          <div className="mh-actions">
            <Button disabled={!ready || busy} onClick={() => void save()}>
              {busy ? "Activating..." : "Activate account"}
            </Button>
            <Button tone="ghost" onClick={() => window.location.assign(getLoginUrl())}>Back to sign in</Button>
          </div>
        </div>
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
    if (profile && isProfileEnabled(profile)) {
      if (!supabase) return;
      await openPortal(supabase, await routeAfterLogin(supabase));
      return;
    }
    window.location.assign(getLoginUrl());
  };

  return (
    <AuthShell>
      <PageHeader title="Unauthorized" />
      <Card tone="amber">
        <h2>This portal is not available for your account.</h2>
        <p>ManFix only opens portals included in your approved account roles.</p>
        <div className="mh-actions">
          <Button onClick={() => void goHome()}>{profile ? "Go to my portals" : "Back to sign in"}</Button>
          {supabase && <Button tone="ghost" onClick={() => void signOut(supabase).then(() => window.location.assign(getLoginUrl()))}>Sign out</Button>}
        </div>
      </Card>
    </AuthShell>
  );
}

export function LogoutPage() {
  const supabase = useMemo(() => createManHubSupabaseClient(), []);

  useEffect(() => {
    if (!supabase) {
      window.location.replace(getLoginUrl());
      return;
    }

    void signOut(supabase, "local")
      .catch(() => undefined)
      .finally(() => window.location.replace(getLoginUrl()));
  }, [supabase]);

  return <AuthShell><EmptyState text="Signing out securely..." /></AuthShell>;
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
      emailRedirectTo: getLoginUrl(),
    },
  });
  if (error) throw error;
  return data.session !== null;
}

export async function signOut(supabase: SupabaseClient, scope: "global" | "local" = "global") {
  const { error } = await supabase.auth.signOut({ scope });
  if (error) throw error;
}

export async function openPortal(supabase: SupabaseClient, destination: string) {
  if (canShareManHubSession(window.location.href, destination)) {
    window.location.replace(destination);
    return;
  }

  if (!getPortalRoleForUrl(destination) && !isAuthAppUrl(destination)) {
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

export async function openPortalSelector(supabase: SupabaseClient) {
  await openPortal(supabase, getPortalSelectorUrl());
}

export function SwitchPortalButton({
  label = "Switch Portal",
  supabase,
}: {
  label?: string;
  supabase: SupabaseClient;
}) {
  const [switching, setSwitching] = useState(false);

  return (
    <Button
      disabled={switching}
      tone="ghost"
      onClick={() => {
        setSwitching(true);
        void openPortalSelector(supabase).catch(() => setSwitching(false));
      }}
    >
      {switching ? "Opening portals..." : label}
    </Button>
  );
}

function PartnerApplicationShell({
  busy,
  children,
  onSubmit,
  status,
  submittedId,
  title,
}: {
  busy: boolean;
  children: ReactNode;
  onSubmit: () => Promise<void>;
  status: string;
  submittedId: string | null;
  title: string;
}) {
  if (submittedId) {
    return (
      <AuthShell>
        <PageHeader title={title} />
        <Card tone="blue">
          <span className="mh-stat-label">Application Received</span>
          <h2>Pending admin review</h2>
          <p>Your reference is {submittedId}. No portal account has been created yet. Approved applicants receive a secure password setup email.</p>
        </Card>
        <div className="mh-actions">
          <Button onClick={() => window.location.assign(getLoginUrl())}>Back to sign in</Button>
          <Button tone="ghost" onClick={() => window.location.assign(getPartnerApplicationsUrl())}>Partner applications</Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <PageHeader title={title}>
        <Button tone="ghost" onClick={() => window.location.assign(getPartnerApplicationsUrl())}>Back</Button>
      </PageHeader>
      <Card tone="blue">
        <span className="mh-stat-label">Approval Required</span>
        <h2>Submit business details for review</h2>
        <p>This application does not create an account. ManFix Admin will review the information and documents first.</p>
      </Card>
      <Card>
        <div className="mh-form-stack">{children}</div>
        <p className="mh-muted-note">{status}</p>
        <div className="mh-actions">
          <Button disabled={busy} onClick={() => void onSubmit()}>
            {busy ? "Submitting..." : "Submit application"}
          </Button>
          <Button disabled={busy} tone="ghost" onClick={() => window.location.assign(getLoginUrl())}>Cancel</Button>
        </div>
      </Card>
    </AuthShell>
  );
}

function usePartnerSubmission(type: PartnerApplicationType) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("All submitted information is reviewed by ManFix Admin.");
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const run = async (submit: (id: string) => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setStatus("Uploading documents and submitting your application...");
    const id = crypto.randomUUID();

    try {
      await submit(id);
      setSubmittedId(id);
      setStatus(`${type} application submitted.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit this application.");
      setBusy(false);
    }
  };

  return { busy, run, status, submittedId };
}

function requireFields(fields: Array<[string, string]>) {
  const missing = fields.find(([, value]) => !value.trim());
  if (missing) throw new Error(`${missing[0]} is required.`);
}

function requireFiles(label: string, files: File[]) {
  if (files.length === 0) throw new Error(`${label} is required.`);
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseWholeNumber(label: string, value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a whole number.`);
  return parsed;
}

function portalDescription(role: PortalRole) {
  const descriptions: Record<PortalRole, string> = {
    admin: "Manage users, partners, payments, warranties, and platform operations.",
    customer: "Manage vehicles, diagnosis, parts, orders, payments, and warranties.",
    supplier: "Manage products, stock, supplier orders, commissions, and withdrawals.",
    technician: "Review incoming work, update repair jobs, and manage your schedule.",
    workshop: "Manage bookings, repair queues, technicians, invoices, and inspections.",
  };
  return descriptions[role];
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <PortalShell eyebrow="ManFix" routes={[]} title="SSO">
      <section className="mh-auth-panel">{children}</section>
    </PortalShell>
  );
}
