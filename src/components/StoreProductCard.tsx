import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Check } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";

interface StoreProductCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  stock?: number;
}

const StoreProductCard = ({ id, name, price, image, description, stock = 99 }: StoreProductCardProps) => {
  const { addItem, items } = useCart();
  const inCart = items.find((i) => i.id === id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (stock <= 0) {
      toast.error("This product is out of stock");
      return;
    }
    addItem({ id, name, price, image, stock });
    toast.success(`${name} added to cart!`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="group overflow-hidden border-border transition-all hover:shadow-lg hover:-translate-y-0.5">
        <div className="aspect-square overflow-hidden bg-muted">
          <img src={image} alt={name} className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        </div>
        <CardContent className="p-4">
          <h3 className="font-display text-base font-semibold text-card-foreground">{name}</h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{description}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-display text-xl font-bold text-primary">${price.toFixed(2)}</span>
            <Button
              size="sm"
              className="gap-2 rounded-lg"
              variant={inCart ? "secondary" : "default"}
              disabled={stock <= 0}
              onClick={handleAddToCart}
            >
              {inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              {stock <= 0 ? "Sold Out" : inCart ? `In Cart (${inCart.quantity})` : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StoreProductCard;
