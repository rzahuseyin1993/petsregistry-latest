import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const PushNotificationToggle = () => {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      setSupported(true);

      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      }
    };
    check();
  }, []);

  const subscribe = async () => {
    if (!user) {
      toast.error("Please sign in to enable push notifications");
      return;
    }
    setIsLoading(true);
    try {
      // Get VAPID public key
      const { data: vapidData } = await supabase.functions.invoke("push-notifications", {
        body: { action: "get-vapid-public" },
      });

      if (!vapidData?.publicKey) {
        toast.error("Push notifications not configured yet. Ask your admin to generate VAPID keys.");
        return;
      }

      // Register service worker
      const reg = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        return;
      }

      // Subscribe
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      const subJson = sub.toJSON();

      // Save subscription to database
      await supabase.from("push_subscriptions" as any).upsert({
        user_id: user.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
      }, { onConflict: "user_id,endpoint" });

      setIsSubscribed(true);
      toast.success("Push notifications enabled!");
    } catch (err: any) {
      console.error("Push subscribe error:", err);
      toast.error("Failed to enable push notifications");
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          // Remove from database
          if (user) {
            await supabase.from("push_subscriptions" as any).delete().eq("user_id", user.id).eq("endpoint", sub.endpoint);
          }
        }
      }
      setIsSubscribed(false);
      toast.success("Push notifications disabled");
    } catch (err) {
      toast.error("Failed to disable push notifications");
    } finally {
      setIsLoading(false);
    }
  };

  if (!supported) return null;

  return (
    <Button
      variant={isSubscribed ? "outline" : "default"}
      size="sm"
      className="gap-2"
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={isLoading}
    >
      {isSubscribed ? (
        <>
          <BellOff className="h-4 w-4" />
          Disable Push
        </>
      ) : (
        <>
          <Bell className="h-4 w-4" />
          Enable Push Alerts
        </>
      )}
    </Button>
  );
};

export default PushNotificationToggle;
