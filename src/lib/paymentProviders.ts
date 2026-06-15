export type PaymentProvider = "airwallex" | "paypal" | "stripe";

/** Stripe is kept in code but hidden/disabled in the UI for now. */
export const HIDDEN_PAYMENT_PROVIDERS: PaymentProvider[] = ["stripe"];

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

export function getCardProvider(providers: PaymentProvider[]): PaymentProvider | null {
  if (providers.includes("airwallex")) return "airwallex";
  if (providers.includes("stripe")) return "stripe";
  return null;
}

export function getPaymentProviderLabel(provider: PaymentProvider): string {
  if (provider === "airwallex") return "Airwallex";
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
