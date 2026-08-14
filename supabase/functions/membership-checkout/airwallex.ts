/** Airwallex helpers (co-located for single-function Supabase deploy). */

export type AirwallexEnv = "demo" | "prod";

export function getAirwallexApiBase(env: AirwallexEnv): string {
  return env === "prod" ? "https://api.airwallex.com" : "https://api-demo.airwallex.com";
}

export function normalizeAirwallexEnv(value: string | null | undefined): AirwallexEnv {
  return value?.trim().toLowerCase() === "prod" ? "prod" : "demo";
}

export async function getAirwallexAccessToken(
  clientId: string,
  apiKey: string,
  env: AirwallexEnv,
  loginAs?: string | null,
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-client-id": clientId.trim(),
    "x-api-key": apiKey.trim(),
  };
  if (loginAs?.trim()) headers["x-login-as"] = loginAs.trim();

  const res = await fetch(`${getAirwallexApiBase(env)}/api/v1/authentication/login`, {
    method: "POST",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    console.error("Airwallex auth error:", data);
    throw new Error(
      (data.message as string) ||
        (data.code as string) ||
        "Failed to authenticate with Airwallex. Check Client ID and API Key.",
    );
  }
  return data.token as string;
}

export type AirwallexCheckoutPayload = {
  provider: "airwallex";
  intent_id: string;
  client_secret: string;
  currency: string;
  env: AirwallexEnv;
  success_url: string;
  cancel_url: string;
};

export async function createAirwallexCheckout(options: {
  clientId: string;
  apiKey: string;
  env: AirwallexEnv;
  amount: number;
  currency?: string;
  merchantOrderId: string;
  returnUrl: string;
  cancelUrl: string;
  descriptor?: string;
  metadata?: Record<string, string>;
  customerEmail?: string | null;
  loginAs?: string | null;
}): Promise<AirwallexCheckoutPayload> {
  if (!Number.isFinite(options.amount) || options.amount <= 0) {
    throw new Error("Invalid payment amount");
  }

  const token = await getAirwallexAccessToken(
    options.clientId,
    options.apiKey,
    options.env,
    options.loginAs,
  );

  const body: Record<string, unknown> = {
    request_id: crypto.randomUUID(),
    amount: Number(options.amount.toFixed(2)),
    currency: options.currency || "USD",
    merchant_order_id: options.merchantOrderId.slice(0, 64),
    return_url: options.returnUrl,
    metadata: options.metadata || {},
    descriptor: options.descriptor || "PetsRegistry",
  };

  if (options.customerEmail?.trim()) {
    body.customer = { email: options.customerEmail.trim() };
  }

  const res = await fetch(`${getAirwallexApiBase(options.env)}/api/v1/pa/payment_intents/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id || !data.client_secret) {
    console.error("Airwallex PaymentIntent error:", data);
    throw new Error(
      (data.message as string) ||
        (data.code as string) ||
        "Failed to create Airwallex payment",
    );
  }

  return {
    provider: "airwallex",
    intent_id: data.id as string,
    client_secret: data.client_secret as string,
    currency: (data.currency as string) || options.currency || "USD",
    env: options.env,
    success_url: options.returnUrl,
    cancel_url: options.cancelUrl,
  };
}

export type ResolvedAirwallexConfig = {
  env: AirwallexEnv;
  loginAs: string | null;
  clientId: string;
  apiKey: string;
  providerKey: "airwallex_demo" | "airwallex_prod" | "airwallex";
};

/** Loads the active Airwallex demo or prod credentials for checkout. */
export async function resolveAirwallexConfig(
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: {
              publishable_key?: string | null;
              secret_key?: string | null;
              is_active?: boolean;
            } | null;
          }>;
        };
        in: (col: string, vals: string[]) => Promise<{ data: { key?: string; value?: string | null }[] | null }>;
      };
    };
  },
): Promise<ResolvedAirwallexConfig | null> {
  const { data: settings } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", [
      "airwallex_checkout_mode",
      "airwallex_environment",
      "airwallex_demo_account_id",
      "airwallex_prod_account_id",
      "airwallex_account_id",
    ]);

  const map = Object.fromEntries((settings || []).map((r) => [r.key, r.value]));
  const env = normalizeAirwallexEnv(map.airwallex_checkout_mode || map.airwallex_environment);
  const providerKey = env === "prod" ? "airwallex_prod" : "airwallex_demo";
  const accountKey = env === "prod" ? "airwallex_prod_account_id" : "airwallex_demo_account_id";
  const loginAs = map[accountKey]?.trim() || map.airwallex_account_id?.trim() || null;

  const { data: row } = await supabase
    .from("payment_settings")
    .select("publishable_key, secret_key, is_active")
    .eq("provider", providerKey)
    .maybeSingle();

  if (row?.is_active && row.publishable_key && row.secret_key) {
    return {
      env,
      loginAs,
      clientId: row.publishable_key,
      apiKey: row.secret_key,
      providerKey,
    };
  }

  // Legacy single-row fallback
  const { data: legacy } = await supabase
    .from("payment_settings")
    .select("publishable_key, secret_key, is_active")
    .eq("provider", "airwallex")
    .maybeSingle();

  if (legacy?.is_active && legacy.publishable_key && legacy.secret_key) {
    return {
      env,
      loginAs,
      clientId: legacy.publishable_key,
      apiKey: legacy.secret_key,
      providerKey: "airwallex",
    };
  }

  return null;
}

/** @deprecated Use resolveAirwallexConfig */
export async function getAirwallexConfig(
  supabase: Parameters<typeof resolveAirwallexConfig>[0],
): Promise<{ env: AirwallexEnv; loginAs: string | null }> {
  const resolved = await resolveAirwallexConfig(supabase);
  if (resolved) return { env: resolved.env, loginAs: resolved.loginAs };

  const { data } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", ["airwallex_checkout_mode", "airwallex_environment", "airwallex_account_id"]);

  const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  return {
    env: normalizeAirwallexEnv(map.airwallex_checkout_mode || map.airwallex_environment),
    loginAs: map.airwallex_account_id?.trim() || null,
  };
}
