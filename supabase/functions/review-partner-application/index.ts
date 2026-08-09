import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type ApplicationType = "supplier" | "workshop" | "technician";
type ReviewAction = "approve" | "reject";

type ReviewRequest = {
  action: ReviewAction;
  applicationId: string;
  applicationType: ApplicationType;
  notes?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const applicationTable: Record<ApplicationType, string> = {
  supplier: "supplier_applications",
  technician: "technician_applications",
  workshop: "workshop_applications",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function applicantName(type: ApplicationType, application: Record<string, unknown>) {
  if (type === "supplier") return String(application.contact_person ?? application.company_name ?? "");
  if (type === "workshop") return String(application.workshop_name ?? "");
  return String(application.full_name ?? "");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Administrator authentication is required." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "The approval service is not configured." }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) {
    return json({ error: "Your administrator session has expired." }, 401);
  }

  const [{ data: adminProfile, error: profileError }, { data: adminRoles, error: rolesError }] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id,status")
      .eq("id", userData.user.id)
      .maybeSingle(),
    adminClient
      .from("user_roles")
      .select("role,status")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "super_admin"]),
  ]);

  if (
    profileError
    || rolesError
    || !adminProfile
    || !["Active", "Approved", "Verified"].includes(adminProfile.status)
    || !(adminRoles ?? []).some((membership) =>
      ["admin", "super_admin"].includes(membership.role)
      && ["Active", "Approved", "Verified"].includes(membership.status)
    )
  ) {
    return json({ error: "Only an approved administrator can review applications." }, 403);
  }

  let payload: ReviewRequest;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "The review request is invalid." }, 400);
  }

  if (
    !["supplier", "workshop", "technician"].includes(payload.applicationType)
    || !["approve", "reject"].includes(payload.action)
    || !payload.applicationId
  ) {
    return json({ error: "Application type, application ID, and action are required." }, 400);
  }

  const table = applicationTable[payload.applicationType];
  const { data: application, error: applicationError } = await adminClient
    .from(table)
    .select("*")
    .eq("id", payload.applicationId)
    .maybeSingle();

  if (applicationError || !application) {
    return json({ error: "Application not found." }, 404);
  }
  if (application.status !== "Pending") {
    return json({ error: `This application is already ${String(application.status).toLowerCase()}.` }, 409);
  }

  const reviewedAt = new Date().toISOString();
  const notes = payload.notes?.trim() || null;

  if (payload.action === "reject") {
    const { error } = await adminClient
      .from(table)
      .update({
        admin_notes: notes,
        reviewed_at: reviewedAt,
        reviewed_by: userData.user.id,
        status: "Rejected",
      })
      .eq("id", payload.applicationId)
      .eq("status", "Pending");

    if (error) return json({ error: error.message }, 400);
    return json({ status: "Rejected" });
  }

  const email = String(application.email ?? "").trim().toLowerCase();
  const fullName = applicantName(payload.applicationType, application);
  const authUrl = Deno.env.get("MANFIX_AUTH_URL") ?? "https://manfix-auth.onrender.com";
  let invitedUserId: string | null = null;
  let createdNewUser = false;

  try {
    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("profiles")
      .select("id,role,status")
      .eq("email", email)
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;

    if (existingProfile) {
      invitedUserId = existingProfile.id;
    } else {
      const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          application_id: payload.applicationId,
          full_name: fullName,
          requested_role: payload.applicationType,
        },
        redirectTo: new URL("/set-password", authUrl).toString(),
      });

      if (inviteError || !invitation.user) {
        throw inviteError ?? new Error("The approved account could not be created.");
      }

      invitedUserId = invitation.user.id;
      createdNewUser = true;
    }

    const { data: existingMemberships, error: membershipsError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", invitedUserId);
    if (membershipsError) throw membershipsError;
    const assignedRoles = Array.from(new Set([
      ...(existingMemberships ?? []).map((membership) => membership.role),
      payload.applicationType,
    ]));

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(invitedUserId, {
      app_metadata: {
        application_id: payload.applicationId,
        roles: assignedRoles,
      },
      user_metadata: {
        application_id: payload.applicationId,
        full_name: fullName,
        requested_role: payload.applicationType,
      },
    });
    if (authUpdateError) throw authUpdateError;

    const { error: profileUpdateError } = await adminClient.from("profiles").upsert({
      approved_at: reviewedAt,
      approved_by: userData.user.id,
      email,
      full_name: fullName,
      id: invitedUserId,
      role: existingProfile?.role ?? payload.applicationType,
      status: existingProfile?.status ?? "Approved",
      updated_at: reviewedAt,
    });
    if (profileUpdateError) throw profileUpdateError;

    const { error: membershipUpdateError } = await adminClient.from("user_roles").upsert({
      assigned_at: reviewedAt,
      assigned_by: userData.user.id,
      role: payload.applicationType,
      status: "Approved",
      updated_at: reviewedAt,
      user_id: invitedUserId,
    }, { onConflict: "user_id,role" });
    if (membershipUpdateError) throw membershipUpdateError;

    if (payload.applicationType === "supplier") {
      const { error } = await adminClient.from("supplier_profiles").upsert({
        bank_account_number: application.bank_account || null,
        company_name: application.company_name,
        contact_name: application.contact_person,
        email,
        phone: application.phone,
        status: "Approved",
        supplier_id: invitedUserId,
        verified: true,
      }, { onConflict: "supplier_id" });
      if (error) throw error;
    }

    if (payload.applicationType === "workshop") {
      const { error } = await adminClient.from("platform_workshops").upsert({
        address: application.address,
        application_id: payload.applicationId,
        brands_supported: application.brands_supported,
        email,
        name: application.workshop_name,
        number_of_lifts: application.number_of_lifts,
        number_of_technicians: application.number_of_technicians,
        operating_hours: application.operating_hours,
        owner_id: invitedUserId,
        phone: application.phone,
        photo_paths: application.workshop_photo_paths,
        ssm_number: application.ssm_number,
        status: "Approved",
      }, { onConflict: "owner_id" });
      if (error) throw error;
    }

    if (payload.applicationType === "technician") {
      const { error } = await adminClient.from("technicians").upsert({
        application_id: payload.applicationId,
        certification: application.certificate_paths?.length ? "Certificates submitted" : null,
        name: application.full_name,
        status: "Available",
        user_id: invitedUserId,
        workshop_owner_id: null,
      }, { onConflict: "user_id" });
      if (error) throw error;
    }

    const { error: applicationUpdateError } = await adminClient
      .from(table)
      .update({
        account_user_id: invitedUserId,
        admin_notes: notes,
        reviewed_at: reviewedAt,
        reviewed_by: userData.user.id,
        status: "Approved",
      })
      .eq("id", payload.applicationId)
      .eq("status", "Pending");
    if (applicationUpdateError) throw applicationUpdateError;

    return json({
      accountUserId: invitedUserId,
      message: createdNewUser
        ? "Application approved. A secure password setup email has been sent."
        : "Application approved. The new portal was added to the existing ManFix account.",
      status: "Approved",
    });
  } catch (error) {
    if (invitedUserId && createdNewUser) {
      await adminClient.auth.admin.deleteUser(invitedUserId).catch(() => undefined);
    }
    return json({
      error: error instanceof Error ? error.message : "The approved account could not be created.",
    }, 400);
  }
});
