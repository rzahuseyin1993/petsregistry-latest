/** PayPal helpers (co-located for single-function Supabase deploy). */

export const getPayPalAccessToken = async (clientId: string, clientSecret: string) => {
  const auth = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  const bases = ["https://api-m.sandbox.paypal.com", "https://api-m.paypal.com"];
  let lastError: Record<string, unknown> | null = null;

  for (const base of bases) {
    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (tokenRes.ok && tokenData.access_token) {
      return { base, accessToken: tokenData.access_token as string };
    }
    lastError = tokenData;
  }

  throw new Error((lastError?.error_description as string) || "Failed to authenticate with PayPal");
};

/** Never pre-fill PayPal with merchant / site admin emails. */
export function sanitizePayerEmail(
  email: string | null | undefined,
  blocked: string[] = [],
): string | null {
  if (!email?.trim()) return null;
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;

  const lower = trimmed.toLowerCase();
  const blocklist = new Set(
    blocked.map((e) => e.trim().toLowerCase()).filter(Boolean),
  );

  if (lower.includes("petsregistry")) return null;
  if (blocklist.has(lower)) return null;

  return trimmed;
}

export async function getBlockedPayPalEmails(
  supabase: { from: (table: string) => { select: (cols: string) => { in: (col: string, vals: string[]) => Promise<{ data: { value?: string | null }[] | null }> } } },
): Promise<string[]> {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .in("key", ["site_email", "support_email", "notification_email"]);
  return (data || [])
    .map((row) => row.value?.trim().toLowerCase())
    .filter((v): v is string => !!v);
}

/** Buyer email: form input → login email → profile (merchant emails excluded). */
export async function resolvePayerEmail(
  supabase: {
    auth: { admin: { getUserById: (id: string) => Promise<{ data: { user?: { email?: string | null } | null } }> } };
    from: (table: string) => { select: (cols: string) => { in: (col: string, vals: string[]) => Promise<{ data: { value?: string | null }[] | null }> } };
  },
  userId: string | null | undefined,
  profileEmail?: string | null,
  explicitEmail?: string | null,
): Promise<string | null> {
  const blocked = await getBlockedPayPalEmails(supabase);
  const candidates: (string | null | undefined)[] = [explicitEmail];

  if (userId) {
    try {
      const { data } = await supabase.auth.admin.getUserById(userId);
      candidates.push(data?.user?.email);
    } catch {
      // ignore — fall back to profile
    }
  }
  candidates.push(profileEmail);

  for (const candidate of candidates) {
    const sanitized = sanitizePayerEmail(candidate, blocked);
    if (sanitized) return sanitized;
  }
  return null;
}

export function buildPayPalApplicationContext(returnUrl: string, cancelUrl: string) {
  return {
    return_url: returnUrl,
    cancel_url: cancelUrl,
    brand_name: "PetsRegistry",
    landing_page: "NO_PREFERENCE",
    shipping_preference: "NO_SHIPPING",
    user_action: "PAY_NOW",
  };
}

export function buildPayPalOrderBody(options: {
  purchase_units: Record<string, unknown>[];
  returnUrl: string;
  cancelUrl: string;
  payerEmail?: string | null;
}) {
  const body: Record<string, unknown> = {
    intent: "CAPTURE",
    purchase_units: options.purchase_units,
    application_context: buildPayPalApplicationContext(options.returnUrl, options.cancelUrl),
  };

  if (options.payerEmail) {
    body.payer = { email_address: options.payerEmail };
  }

  return body;
}

export async function createPayPalOrder(
  baseUrl: string,
  accessToken: string,
  orderBody: Record<string, unknown>,
): Promise<{ id: string; approvalUrl: string }> {
  const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderBody),
  });

  const orderData = await orderRes.json();
  if (!orderData.id) {
    console.error("PayPal order error:", orderData);
    throw new Error(orderData.message || "Failed to create PayPal order");
  }

  const approvalLink = orderData.links?.find((l: { rel: string; href?: string }) => l.rel === "approve")?.href;
  if (!approvalLink) {
    console.error("PayPal order missing approval link:", orderData);
    throw new Error(
      orderData?.message || orderData?.details?.[0]?.description || "PayPal did not return an approval link",
    );
  }

  const payer = orderBody.payer as { email_address?: string } | undefined;
  let approvalUrl = approvalLink;
  if (payer?.email_address) {
    try {
      const url = new URL(approvalLink);
      url.searchParams.set("email", payer.email_address);
      approvalUrl = url.toString();
    } catch {
      approvalUrl = approvalLink;
    }
  }

  return { id: orderData.id, approvalUrl };
}
