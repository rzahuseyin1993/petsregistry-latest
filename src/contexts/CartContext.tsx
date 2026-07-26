import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalItems: 0,
  totalPrice: 0,
});

export const useCart = () => useContext(CartContext);

const CART_KEY = "pet-store-cart";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const hadUserRef = useRef(false);
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item: CartItem) => ({
        ...item,
        price: Number(item.price) || 0,
        stock: Number(item.stock) || 0,
        quantity: Number(item.quantity) || 1,
      }));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  // Clear cart when the user signs out (not on every anonymous page load).
  useEffect(() => {
    if (user) {
      hadUserRef.current = true;
      return;
    }
    if (hadUserRef.current) {
      setItems([]);
      localStorage.removeItem(CART_KEY);
      hadUserRef.current = false;
    }
  }, [user]);

  const addItem = (item: Omit<CartItem, "quantity">) => {
    const normalized = { ...item, price: Number(item.price) || 0, stock: Number(item.stock) || 0 };
    setItems((prev) => {
      const existing = prev.find((i) => i.id === normalized.id);
      if (existing) {
        if (existing.quantity >= normalized.stock) return prev;
        return prev.map((i) => i.id === normalized.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...normalized, quantity: 1 }];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(id);
      return;
    }
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.min(quantity, i.stock) } : i));
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem(CART_KEY);
  };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
};
