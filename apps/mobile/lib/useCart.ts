import { useState } from 'react';

export type CartItem = {
  barangId: string;
  nama: string;
  kategori: string;
  satuan: string;
  stok: number;
  jumlah: number;
};

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addItem = (item: Omit<CartItem, 'jumlah'>) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.barangId === item.barangId);
      if (existing) {
        // Tidak boleh melebihi stok yang tersedia
        if (existing.jumlah >= item.stok) return prev;
        return prev.map((c) =>
          c.barangId === item.barangId ? { ...c, jumlah: c.jumlah + 1 } : c
        );
      }
      return [...prev, { ...item, jumlah: 1 }];
    });
  };

  const removeItem = (barangId: string) => {
    setCart((prev) => prev.filter((c) => c.barangId !== barangId));
  };

  const updateJumlah = (barangId: string, jumlah: number) => {
    if (jumlah <= 0) {
      removeItem(barangId);
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.barangId === barangId ? { ...c, jumlah } : c))
    );
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, c) => sum + c.jumlah, 0);

  return { cart, addItem, removeItem, updateJumlah, clearCart, totalItems };
}
