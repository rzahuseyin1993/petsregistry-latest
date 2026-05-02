import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads tracking code settings from site_settings and injects them into <head> / <body>.
 * Supports: Google Analytics (GA4), Google Tag Manager, and custom head/body scripts.
 */
const TRACKING_KEYS = [
  "seo_google_analytics_id",
  "seo_gtm_id",
  "seo_head_code",
  "seo_body_code",
  "seo_meta_title",
  "seo_meta_description",
  "seo_meta_keywords",
  "seo_og_image",
];

const TrackingCodeInjector = () => {
  const { data: settings } = useQuery({
    queryKey: ["tracking-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", TRACKING_KEYS);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        if (s.value) map[s.key] = s.value;
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!settings) return;

    const injected: HTMLElement[] = [];

    // Update document title
    if (settings.seo_meta_title) {
      document.title = settings.seo_meta_title;
    }

    // Update/create meta description
    if (settings.seo_meta_description) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
        injected.push(meta);
      }
      meta.content = settings.seo_meta_description;
    }

    // Update/create meta keywords
    if (settings.seo_meta_keywords) {
      let meta = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "keywords";
        document.head.appendChild(meta);
        injected.push(meta);
      }
      meta.content = settings.seo_meta_keywords;
    }

    // Update OG image
    if (settings.seo_og_image) {
      let meta = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
      if (meta) meta.content = settings.seo_og_image;
    }

    // Google Analytics (GA4)
    const gaId = settings.seo_google_analytics_id;
    if (gaId && gaId.startsWith("G-")) {
      const gaScript = document.createElement("script");
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(gaScript);
      injected.push(gaScript);

      const gaInit = document.createElement("script");
      gaInit.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
      document.head.appendChild(gaInit);
      injected.push(gaInit);
    }

    // Google Tag Manager
    const gtmId = settings.seo_gtm_id;
    if (gtmId && gtmId.startsWith("GTM-")) {
      const gtmScript = document.createElement("script");
      gtmScript.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
      document.head.appendChild(gtmScript);
      injected.push(gtmScript);

      // GTM noscript iframe
      const noscript = document.createElement("noscript");
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
      iframe.height = "0";
      iframe.width = "0";
      iframe.style.display = "none";
      iframe.style.visibility = "hidden";
      noscript.appendChild(iframe);
      document.body.insertBefore(noscript, document.body.firstChild);
      injected.push(noscript);
    }

    // Custom head code
    if (settings.seo_head_code) {
      const container = document.createElement("div");
      container.id = "custom-head-code";
      container.innerHTML = settings.seo_head_code;
      Array.from(container.children).forEach((child) => {
        const el = child as HTMLElement;
        document.head.appendChild(el);
        injected.push(el);
      });
    }

    // Custom body code
    if (settings.seo_body_code) {
      const container = document.createElement("div");
      container.id = "custom-body-code";
      container.innerHTML = settings.seo_body_code;
      Array.from(container.children).forEach((child) => {
        const el = child as HTMLElement;
        document.body.appendChild(el);
        injected.push(el);
      });
    }

    return () => {
      injected.forEach((el) => el.parentNode?.removeChild(el));
    };
  }, [settings]);

  return null;
};

export default TrackingCodeInjector;
