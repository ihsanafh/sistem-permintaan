import { create } from 'zustand';

export interface CartItem {
  barangId: string;
  nama: string;
  kategori: string;
  satuan: string;
  stok: number;
  jumlah: number;
}

export interface AddItemInput {
  id: string;
  nama: string;
  kategori: string;
  satuan: string;
  stok: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: AddItemInput) => boolean;
  removeItem: (barangId: string) => void;
  updateJumlah: (barangId: string, jumlah: number) => boolean;
  incrementJumlah: (barangId: string) => boolean;
  decrementJumlah: (barangId: string) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getItemCount: (barangId: string) => number;
}

export const useCart = create<CartStore>((set, get) => ({
  items: [],

  // Menambahkan item ke keranjang (Aturan PRD: tidak boleh melebihi stok yang ada)
  addItem: (item) => {
    if (item.stok <= 0) return false;

    const { items } = get();
    const existing = items.find((c) => c.barangId === item.id);

    if (existing) {
      if (existing.jumlah >= item.stok) return false;
      set({
        items: items.map((c) =>
          c.barangId === item.id ? { ...c, jumlah: c.jumlah + 1 } : c
        ),
      });
      return true;
    }

    set({
      items: [
        ...items,
        {
          barangId: item.id,
          nama: item.nama,
          kategori: item.kategori,
          satuan: item.satuan,
          stok: item.stok,
          jumlah: 1,
        },
      ],
    });
    return true;
  },

  // Menghapus item dari keranjang
  removeItem: (barangId) => {
    set({
      items: get().items.filter((c) => c.barangId !== barangId),
    });
  },

  // Update jumlah manual dengan validasi bilangan bulat positif <= stok
  updateJumlah: (barangId, jumlah) => {
    const validQty = Math.floor(jumlah);
    if (isNaN(validQty) || validQty <= 0) {
      get().removeItem(barangId);
      return true;
    }

    const { items } = get();
    const existing = items.find((c) => c.barangId === barangId);
    if (!existing) return false;

    const finalQty = Math.min(validQty, existing.stok);
    set({
      items: items.map((c) =>
        c.barangId === barangId ? { ...c, jumlah: finalQty } : c
      ),
    });
    return true;
  },

  // Tambah jumlah (+1)
  incrementJumlah: (barangId) => {
    const { items } = get();
    const existing = items.find((c) => c.barangId === barangId);
    if (!existing || existing.jumlah >= existing.stok) return false;

    set({
      items: items.map((c) =>
        c.barangId === barangId ? { ...c, jumlah: c.jumlah + 1 } : c
      ),
    });
    return true;
  },

  // Kurangi jumlah (-1). Jika mencapai 0, item otomatis dihapus
  decrementJumlah: (barangId) => {
    const { items } = get();
    const existing = items.find((c) => c.barangId === barangId);
    if (!existing) return;

    if (existing.jumlah <= 1) {
      get().removeItem(barangId);
    } else {
      set({
        items: items.map((c) =>
          c.barangId === barangId ? { ...c, jumlah: c.jumlah - 1 } : c
        ),
      });
    }
  },

  // Kosongkan seluruh keranjang
  clearCart: () => set({ items: [] }),

  // Hitung total unit barang yang ada di keranjang
  getTotalItems: () => {
    return get().items.reduce((total, item) => total + item.jumlah, 0);
  },

  // Dapatkan kuantitas suatu item tertentu di keranjang
  getItemCount: (barangId) => {
    const item = get().items.find((c) => c.barangId === barangId);
    return item ? item.jumlah : 0;
  },
}));
