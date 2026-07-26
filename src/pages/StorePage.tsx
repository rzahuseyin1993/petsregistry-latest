import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CmsRenderer from "@/components/CmsRenderer";
import StoreProductCard from "@/components/StoreProductCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useStoreEnabled } from "@/hooks/useStoreEnabled";

const StorePage = () => {
  const navigate = useNavigate();
  const { storeEnabled, isLoading: storeSettingLoading } = useStoreEnabled();

  useEffect(() => {
    if (!storeSettingLoading && !storeEnabled) {
      navigate("/", { replace: true });
    }
  }, [storeEnabled, storeSettingLoading, navigate]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("active", true).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  if (storeSettingLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex flex-1 items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!storeEnabled) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex flex-1 items-center justify-center py-20">
          <div className="mx-auto max-w-md px-4 text-center">
            <ShoppingCart className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h1 className="font-display text-2xl font-bold text-foreground">Store is temporarily closed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The public store is turned off in Admin → Products. Redirecting you home…
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <CmsRenderer slug="store" fallback={
      <main className="flex-1 py-10">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <ShoppingCart className="h-7 w-7 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Pet Safety Store</h1>
            <p className="mt-2 text-muted-foreground">GPS trackers, smart tags, and accessories to keep your pets safe.</p>
          </div>
          {isLoading ? (
            <div className="mt-16 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : products.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-lg text-muted-foreground">No products available yet. Check back soon!</p>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <StoreProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={Number(product.price) || 0}
                  image={product.image_url || "/placeholder.svg"}
                  description={product.description || ""}
                  stock={product.stock}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      } />
      <Footer />
    </div>
  );
};

export default StorePage;
