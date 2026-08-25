export type PaymentProvider = "airwallex" | "paypal" | "stripe";

/** Airwallex Payments rejected for YEPEE LLP — hide from checkout UI. */
export const HIDDEN_PAYMENT_PROVIDERS: PaymentProvider[] = ["airwallex"];

export type AirwallexCheckoutPayload = {
  provider: "airwallex";
  intent_id: string;
  client_secret: string;
  currency: string;
  env: "demo" | "prod";
  success_url: string;
  cancel_url: string;
};

export type CheckoutResponse = {
  url?: string;
  checkout?: AirwallexCheckoutPayload;
  error?: string;
  success?: boolean;
};

export function filterVisiblePaymentProviders(providers: string[]): PaymentProvider[] {
  return providers.filter(
    (p): p is PaymentProvider =>
      (p === "airwallex" || p === "paypal" || p === "stripe") &&
      !HIDDEN_PAYMENT_PROVIDERS.includes(p as PaymentProvider),
  );
}

/** Map stored gateway rows to checkout-visible providers. */
export function normalizeActivePaymentProviders(
  rows: { provider: string; is_active: boolean }[],
): PaymentProvider[] {
  const active = new Set(rows.filter((row) => row.is_active).map((row) => row.provider));
  const providers: PaymentProvider[] = [];

  if (active.has("stripe")) providers.push("stripe");
  if (active.has("paypal")) providers.push("paypal");

  return filterVisiblePaymentProviders(providers);
}

export function getCardProvider(providers: PaymentProvider[]): PaymentProvider | null {
  if (providers.includes("stripe")) return "stripe";
  return null;
}

export function getPaymentProviderLabel(provider: PaymentProvider): string {
  if (provider === "stripe") return "Card (Stripe)";
  if (provider === "paypal") return "PayPal";
  return "Card";
}

export async function parseFunctionError(error: unknown): Promise<string> {
  const fnError = error as { message?: string; context?: Response };
  if (fnError?.context) {
    const body = await fnError.context.json().catch(() => ({}));
    if (body?.error) return body.error as string;
  }
  return fnError?.message || "Checkout failed";
}
