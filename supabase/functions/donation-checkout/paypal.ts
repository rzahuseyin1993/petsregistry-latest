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

export function buildPayPalApplicationContext(returnUrl: string, cancelUrl: string) {
  return {
    return_url: returnUrl,
    cancel_url: cancelUrl,
    brand_name: "PetsRegistry",
    landing_page: "GUEST_CHECKOUT",
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

  const payerEmail = sanitizePayerEmail(options.payerEmail);
  if (payerEmail) {
    body.payer = { email_address: payerEmail };
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

  return { id: orderData.id, approvalUrl: approvalLink };
}
