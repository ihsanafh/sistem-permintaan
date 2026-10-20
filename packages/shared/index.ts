export type Role = 'pegawai' | 'admin' | 'petugas';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  divisi?: string;
}

export interface Barang {
  id: string;
  nama: string;
  kategori: string;
  stok: number;
  satuan: string;
  aktif: boolean;
}

export type StatusPermintaan = 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Disiapkan' | 'Diantar' | 'Diterima' | 'Diterima (Otomatis)' | 'Sanggahan';

export interface PermintaanItem {
  barangId: string;
  namaBarang: string;
  jumlahDiminta: number;
  jumlahDisetujui?: number;
  kategori: string; // for report
}

export interface Permintaan {
  id: string;
  pegawaiId: string;
  namaPegawai: string;
  divisi: string;
  items: PermintaanItem[];
  status: StatusPermintaan;
  tanggalPengajuan: Date | any; // Firestore timestamp
  waktuSelesai?: Date | any; // Firestore timestamp
  catatan?: string;
  alasanTolak?: string;
}

export interface DeliveryLog {
  id: string;
  permintaanId: string;
  petugasId: string;
  pegawaiId: string;
  status: 'Diterima' | 'Ditolak' | 'Tidak di Tempat';
  catatan?: string;
  timestamp: Date | any;
}

export type TipeRiwayatStok = 'Permintaan Pegawai' | 'Restock Excel' | 'Stock Opname' | 'Pengembalian (Gagal Antar)';

export interface RiwayatStok {
  id: string;
  barangId: string;
  tipe: TipeRiwayatStok;
  perubahan: number; // positive or negative
  stokAkhir: number;
  timestamp: Date | any;
  pelakuId: string;
  keterangan?: string;
}
