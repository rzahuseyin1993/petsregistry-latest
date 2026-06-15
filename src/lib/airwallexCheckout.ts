import type { AirwallexCheckoutPayload } from "@/lib/paymentProviders";

declare global {
  interface Window {
    AirwallexComponentsSDK?: {
      init: (options: {
        env: "demo" | "prod";
        enabledElements: string[];
      }) => Promise<{
        payments: {
          redirectToCheckout: (options: Record<string, unknown>) => void;
        };
      }>;
    };
    Airwallex?: {
      init: (options: { env: string; origin?: string }) => void;
      redirectToCheckout: (options: Record<string, unknown>) => void;
    };
  }
}

/** Official Airwallex.js CDN (see Airwallex hosted payment page quickstart). */
const AIRWALLEX_SCRIPT_SRC = "https://static.airwallex.com/components/sdk/v1/index.js";

let airwallexScriptPromise: Promise<void> | null = null;

function loadAirwallexScript(): Promise<void> {
  if (window.AirwallexComponentsSDK || window.Airwallex) {
    return Promise.resolve();
  }

  if (airwallexScriptPromise) return airwallexScriptPromise;

  airwallexScriptPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.AirwallexComponentsSDK || window.Airwallex) {
        resolve();
      } else {
        reject(new Error("Airwallex checkout SDK failed to initialize"));
      }
    };

    const existing = document.querySelector(`script[src="${AIRWALLEX_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => finish(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Airwallex checkout")), { once: true });
      // Script may have loaded before listeners were attached
      if ((existing as HTMLScriptElement).dataset.loaded === "true") finish();
      return;
    }

    const script = document.createElement("script");
    script.src = AIRWALLEX_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      finish();
    };
    script.onerror = () => reject(new Error("Failed to load Airwallex checkout"));
    document.head.appendChild(script);
  });

  return airwallexScriptPromise;
}

export async function redirectToAirwallexCheckout(checkout: AirwallexCheckoutPayload): Promise<void> {
  await loadAirwallexScript();

  const redirectOptions = {
    env: checkout.env,
    mode: "payment",
    intent_id: checkout.intent_id,
    client_secret: checkout.client_secret,
    currency: checkout.currency,
    successUrl: checkout.success_url,
    cancelUrl: checkout.cancel_url,
  };

  if (window.AirwallexComponentsSDK) {
    const { payments } = await window.AirwallexComponentsSDK.init({
      env: checkout.env,
      enabledElements: ["payments"],
    });
    payments.redirectToCheckout(redirectOptions);
    return;
  }

  if (window.Airwallex) {
    window.Airwallex.init({
      env: checkout.env,
      origin: window.location.origin,
    });
    window.Airwallex.redirectToCheckout({
      ...redirectOptions,
      failUrl: checkout.cancel_url,
    });
    return;
  }

  throw new Error("Airwallex checkout SDK failed to initialize");
}

export async function completeCheckout(data: {
  url?: string;
  checkout?: AirwallexCheckoutPayload;
}): Promise<void> {
  if (data.checkout?.provider === "airwallex") {
    await redirectToAirwallexCheckout(data.checkout);
    return;
  }
  if (data.url) {
    window.location.href = data.url;
    return;
  }
  throw new Error("No checkout destination returned");
}
