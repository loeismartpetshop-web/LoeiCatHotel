import "server-only";

interface AuthUser {
  id?: string;
  email?: string;
}

export interface StaffSession {
  userId: string;
  email: string;
  fullName: string;
  role: string;
}

export function getStaffConfig() {
  const url = process.env.SUPABASE_URL
    ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? process.env.PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !secret || !publishable) throw new Error("Supabase environment variables are missing");
  return { url: url.replace(/\/$/, ""), secret, publishable };
}

export async function staffAdminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, secret } = getStaffConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export async function requireStaffSession(request: Request): Promise<StaffSession> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Response("unauthorized", { status: 401 });

  const { url, publishable } = getStaffConfig();
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    cache: "no-store",
    headers: { apikey: publishable, Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) throw new Response("unauthorized", { status: 401 });

  const user = await userResponse.json() as AuthUser;
  if (!user.id || !user.email) throw new Response("unauthorized", { status: 401 });
  const staff = await staffAdminRequest<Array<{
    auth_user_id: string;
    full_name: string;
    role: string;
    is_active: boolean;
  }>>(`staff_profiles?select=auth_user_id,full_name,role,is_active&auth_user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&limit=1`);
  if (!staff[0] || !["owner", "front_desk"].includes(staff[0].role)) {
    throw new Response("forbidden", { status: 403 });
  }
  return { userId: user.id, email: user.email, fullName: staff[0].full_name, role: staff[0].role };
}

export async function verifyStaffPassword(email: string, password: string): Promise<boolean> {
  if (!email || !password) return false;
  const { url, publishable } = getStaffConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: publishable,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  return response.ok;
}

export async function writeAudit(input: {
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string;
}) {
  await staffAdminRequest("audit_log", {
    method: "POST",
    body: JSON.stringify({
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      actor_user_id: input.actorUserId,
      actor_type: "staff",
      before_data: input.beforeData ?? null,
      after_data: input.afterData ?? null,
      reason: input.reason ?? null
    })
  });
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
