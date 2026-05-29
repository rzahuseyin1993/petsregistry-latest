import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRIVATE_IP =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|::1$|localhost$)/;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let body: { country?: string } = {};
    try {
      body = await req.json();
    } catch {
      /* GET has no body */
    }
    const override = url.searchParams.get("country")?.trim() || body.country?.trim();
    if (override) {
      const code = override.length === 2 ? override.toUpperCase() : null;
      return json({ countryCode: code, countryName: override, source: "override" });
    }

    const cfCountry = req.headers.get("cf-ipcountry");
    if (cfCountry && cfCountry !== "XX") {
      return json({
        countryCode: cfCountry,
        countryName: cfCountry,
        source: "cf-ipcountry",
      });
    }

    const forwarded = req.headers.get("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "";

    if (!ip || PRIVATE_IP.test(ip)) {
      return json({ countryCode: null, countryName: null, source: "local" });
    }

    const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "pet-palace-hub/1.0" },
    });

    if (!geoRes.ok) {
      return json({ countryCode: null, countryName: null, source: "geo-error" });
    }

    const geo = await geoRes.json();
    if (geo.error) {
      return json({ countryCode: null, countryName: null, source: "geo-error" });
    }

    return json({
      countryCode: geo.country_code ?? null,
      countryName: geo.country_name ?? null,
      source: "ipapi",
    });
  } catch (e) {
    console.error("visitor-country:", e);
    return json({ countryCode: null, countryName: null, source: "error" });
  }
});
