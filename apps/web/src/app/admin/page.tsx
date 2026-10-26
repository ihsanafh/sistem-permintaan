'use client';

import { useEffect, useState } from 'react';
import { Package, UploadCloud, ClipboardList, TrendingUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { collection, getCountFromServer, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Pastikan path import ini sesuai dengan lokasi firebase.ts Anda

const quickActions = [
  { label: 'Kelola Master Barang', desc: 'Tambah, edit, non-aktifkan barang', icon: Package, href: '/admin/barang', color: 'from-blue-500 to-blue-600' },
  { label: 'Upload Restock Excel', desc: 'Tambah stok via file Excel', icon: UploadCloud, href: '/admin/restock', color: 'from-green-500 to-emerald-600' },
  { label: 'Stock Opname', desc: 'Penyesuaian fisik stok gudang', icon: ClipboardList, href: '/admin/stock-opname', color: 'from-violet-500 to-purple-600' },
];

export default function AdminDashboard() {
  // State untuk menyimpan data statistik
  const [totalBarang, setTotalBarang] = useState<number | string>('-');
  const [stokMenipis, setStokMenipis] = useState<number | string>('-');
  const [lastRestock, setLastRestock] = useState<string>('-');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const barangRef = collection(db, 'barang');

        // 1. Ambil Total Item Barang
        const totalSnapshot = await getCountFromServer(barangRef);
        setTotalBarang(totalSnapshot.data().count);

        // 2. Ambil Stok Menipis (Stok di bawah 5)
        const menipisQuery = query(barangRef, where('stok', '<', 5));
        const menipisSnapshot = await getCountFromServer(menipisQuery);
        setStokMenipis(menipisSnapshot.data().count);

        // 3. Ambil Tanggal Restock Terakhir
        try {
          const restockRef = collection(db, 'restock');
          const restockQuery = query(restockRef, orderBy('createdAt', 'desc'), limit(1));
          const restockSnap = await getDocs(restockQuery);
          
          if (!restockSnap.empty) {
            const data = restockSnap.docs[0].data();
            const date = data.createdAt?.toDate();
            if (date) {
              setLastRestock(date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
            }
          } else {
            setLastRestock('Belum ada');
          }
        } catch (error) {
          // Fallback jika koleksi 'restock' belum ada atau error index
          setLastRestock('-'); 
        }

      } catch (error) {
        console.error("Gagal mengambil data statistik:", error);
      }
    };

    fetchStats();
  }, []);

  // Pindahkan array stats ke dalam komponen agar bisa membaca state
  const stats = [
    { label: 'Total Item Barang', value: totalBarang, icon: Package, color: 'bg-blue-500', href: '/admin/barang' },
    { label: 'Stok Menipis (< 5)', value: stokMenipis, icon: AlertTriangle, color: 'bg-amber-500', href: '/admin/barang' },
    { label: 'Restock Terakhir', value: lastRestock, icon: TrendingUp, color: 'bg-green-500', href: '/admin/restock' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Admin</h1>
        <p className="text-slate-500 mt-1 text-sm">Sistem Permintaan Barang Internal</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition-shadow flex items-center gap-4">
            <div className={`${s.color} p-3 rounded-xl text-white`}>
              <s.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Aksi Cepat</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {quickActions.map((a) => (
          <Link key={a.label} href={a.href}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
              <a.icon size={18} />
            </div>
            <p className="font-semibold text-slate-800 text-sm">{a.label}</p>
            <p className="text-xs text-slate-500 mt-1">{a.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}