'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  runTransaction,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  AlertCircle,
  PackageCheck,
  ChevronDown,
  ChevronUp,
  User,
  Building,
  Calendar,
  FileText,
  AlertTriangle,
  RotateCw,
  Truck,
  X,
  MapPin,
} from 'lucide-react';

// ==========================================
// 1. Tipe Data (Sesuai Skema Firestore & PRD)
// ==========================================
export interface PermintaanItem {
  barangId: string;
  namaBarang: string;
  kategori: string;
  satuan: string;
  jumlah: number;
}

export interface Permintaan {
  id: string;
  userId?: string;
  pegawaiId: string;
  namaPegawai: string;
  emailPegawai?: string;
  divisi?: string;
  status: 'Menunggu Persetujuan' | 'Disiapkan' | 'Diterima' | 'Diterima (Otomatis)' | 'Ditolak';
  tanggalPengajuan?: any;
  createdAt?: any;
  catatan?: string;
  items: PermintaanItem[];
  totalJenisBarang?: number;
  totalKuantitas?: number;
  approvedAt?: any;
  approvedBy?: string;
  approvedByEmail?: string;
  alasanPenolakan?: string;
}

export interface MasterBarangStock {
  id: string;
  nama: string;
  stok: number;
  satuan: string;
}

// ==========================================
// 2. Modal Timeline Lacak Pengantaran (delivery_logs)
// ==========================================
function TrackingModal({
  permintaan,
  onClose,
}: {
  permintaan: Permintaan;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'delivery_logs'),
      where('permintaanId', '==', permintaan.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Urutkan kronologis
        list.sort((a, b) => {
          const tA = a.timestamp?.seconds || (a.timestamp ? new Date(a.timestamp).getTime() / 1000 : 0);
          const tB = b.timestamp?.seconds || (b.timestamp ? new Date(b.timestamp).getTime() / 1000 : 0);
          return tA - tB;
        });

        setLogs(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching delivery logs:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [permintaan.id]);

  const formatWaktu = (ts: any) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Truck size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Lacak Riwayat Pengantaran</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pemohon: <span className="font-semibold text-slate-700">{permintaan.namaPegawai}</span> ({permintaan.divisi || 'Umum'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Ringkasan Status & Item */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500">Status Saat Ini: </span>
            <span
              className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] inline-flex items-center gap-1 ${
                permintaan.status === 'Diterima'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : permintaan.status === 'Diterima (Otomatis)'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : permintaan.status === 'Disiapkan'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : permintaan.status === 'Ditolak'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {permintaan.status}
            </span>
          </div>
          <div className="text-slate-500">
            Total: <span className="font-semibold text-slate-800">{permintaan.items.length} item</span> (
            {permintaan.items.reduce((acc, i) => acc + i.jumlah, 0)} unit)
          </div>
        </div>

        {/* Timeline Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <RotateCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-xs">Memuat riwayat pengantaran...</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {/* Event 1: Pengajuan Dibuat */}
              <div className="relative">
                <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-slate-400 border-2 border-white ring-2 ring-slate-200" />
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800">Pengajuan Permintaan Dibuat</p>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatWaktu(permintaan.tanggalPengajuan || permintaan.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Oleh: <span className="font-semibold text-slate-700">{permintaan.namaPegawai}</span> ({permintaan.divisi || 'Umum'})
                  </p>
                  {permintaan.catatan && (
                    <div className="mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200/60 text-[11px] text-slate-600 italic">
                      &ldquo;{permintaan.catatan}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* Event 2: Disetujui / Disiapkan (Jika sudah disetujui) */}
              {permintaan.approvedAt && (
                <div className="relative">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white ring-2 ring-blue-200" />
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-blue-700">Disetujui Gudang & Masuk Antrean Antar</p>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatWaktu(permintaan.approvedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Oleh: <span className="font-semibold text-slate-700">{permintaan.approvedByEmail || 'Admin Gudang'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Stok barang telah dipotong di gudang dan masuk ke daftar siap antar kurir.
                    </p>
                  </div>
                </div>
              )}

              {/* Event 3: Riwayat dari delivery_logs */}
              {logs.map((log, idx) => {
                const isDiterima = log.hasil === 'Diterima' || log.hasil === 'Diterima (Otomatis)';
                const isPending = log.hasil === 'Pegawai Tidak di Tempat';
                const isDitolak = log.hasil === 'Ditolak Pegawai';
                const isCron = log.petugasId === 'system_cron';

                return (
                  <div key={idx} className="relative">
                    <div
                      className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white ${
                        isDiterima
                          ? 'bg-emerald-500 ring-2 ring-emerald-200'
                          : isPending
                          ? 'bg-amber-500 ring-2 ring-amber-200'
                          : isDitolak
                          ? 'bg-red-500 ring-2 ring-red-200'
                          : 'bg-blue-500 ring-2 ring-blue-200'
                      }`}
                    />
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-800">
                            {isCron ? 'Otomatisasi Cron Sistem' : 'Catatan Pengantaran Kurir'}
                          </p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                              isDiterima
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isPending
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : isDitolak
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {log.hasil}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatWaktu(log.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mt-0.5">
                        Pelaksana: <span className="font-semibold text-slate-700">{log.namaPetugas}</span>
                      </p>

                      {log.catatan && (
                        <div className="mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200/60 text-[11px] text-slate-700 leading-relaxed">
                          <strong>Catatan:</strong> {log.catatan}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Fallback Jika Belum Ada Pengantaran */}
              {logs.length === 0 && !permintaan.approvedAt && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <p className="font-semibold">Menunggu Verifikasi & Persetujuan</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Permintaan ini belum disetujui oleh admin, sehingga belum diteruskan ke petugas antar.
                  </p>
                </div>
              )}

              {logs.length === 0 && permintaan.approvedAt && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                  <p className="font-semibold">Dalam Antrean Kurir</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    Barang telah disiapkan dan saat ini sedang menunggu kurir melakukan pengantaran fisik serta mencatat log.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. Halaman Utama Permintaan (Admin)
// ==========================================
export default function AdminPermintaanPage() {
  const { profile } = useAuth();

  // State Data
  const [permintaanList, setPermintaanList] = useState<Permintaan[]>([]);
  const [masterBarangMap, setMasterBarangMap] = useState<Record<string, MasterBarangStock>>({});
  const [loading, setLoading] = useState(true);

  // State Filter & UI
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'Menunggu' | 'Disiapkan' | 'Semua'>('Menunggu');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // State Tracking Modal
  const [trackingPermintaan, setTrackingPermintaan] = useState<Permintaan | null>(null);

  // State Aksi Transaksi
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; namaPegawai: string } | null>(null);
  const [alasanPenolakan, setAlasanPenolakan] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // ----------------------------------------------------
  // Real-time Listener: Koleksi Permintaan & Master Barang
  // ----------------------------------------------------
  useEffect(() => {
    // 1. Dapatkan stok real-time master barang
    const unsubscribeBarang = onSnapshot(collection(db, 'barang'), (snapshot) => {
      const bMap: Record<string, MasterBarangStock> = {};
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        bMap[docSnap.id] = {
          id: docSnap.id,
          nama: d.nama || '',
          stok: typeof d.stok === 'number' ? d.stok : 0,
          satuan: d.satuan || 'Pcs',
        };
      });
      setMasterBarangMap(bMap);
    });

    // 2. Dapatkan real-time data permintaan
    let q;
    try {
      q = query(collection(db, 'permintaan'), orderBy('createdAt', 'desc'));
    } catch {
      q = collection(db, 'permintaan');
    }

    const unsubscribePermintaan = onSnapshot(
      q,
      (snapshot) => {
        const items: Permintaan[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: docSnap.id,
            userId: data.userId,
            pegawaiId: data.pegawaiId || data.userId || '',
            namaPegawai: data.namaPegawai || 'Pegawai',
            emailPegawai: data.emailPegawai || '',
            divisi: data.divisi || 'Umum',
            status: data.status || 'Menunggu Persetujuan',
            tanggalPengajuan: data.tanggalPengajuan || data.createdAt,
            createdAt: data.createdAt,
            catatan: data.catatan || '',
            items: Array.isArray(data.items) ? data.items : [],
            totalJenisBarang: data.totalJenisBarang || data.items?.length || 0,
            totalKuantitas: data.totalKuantitas || 0,
            approvedAt: data.approvedAt,
            approvedBy: data.approvedBy,
            alasanPenolakan: data.alasanPenolakan,
          });
        });

        // Urutkan berdasarkan waktu pengajuan jika orderBy belum terindeks
        items.sort((a, b) => {
          const timeA = a.tanggalPengajuan?.seconds || a.createdAt?.seconds || 0;
          const timeB = b.tanggalPengajuan?.seconds || b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

        setPermintaanList(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching permintaan:', err);
        showToast(`Gagal memuat data permintaan: ${err.message}`, 'error');
        setLoading(false);
      }
    );

    return () => {
      unsubscribeBarang();
      unsubscribePermintaan();
    };
  }, []);

  // ----------------------------------------------------
  // LOGIKA TRANSAKSI ATOMIK (ATURAN PRD BAGIAN 8)
  // ----------------------------------------------------
  const handleApprove = async (permintaan: Permintaan) => {
    if (!auth.currentUser) {
      showToast('Sesi login admin tidak valid. Silakan login ulang.', 'error');
      return;
    }

    setApprovingId(permintaan.id);

    try {
      await runTransaction(db, async (transaction) => {
        // ==========================================================
        // TAHAP 1: BACA SEMUA DOKUMEN (READS FIRST)
        // Firestore mewajibkan seluruh pembacaan terjadi sebelum penulisan.
        // ==========================================================
        const barangReads: {
          item: PermintaanItem;
          docRef: any;
          currentStock: number;
        }[] = [];

        for (const item of permintaan.items) {
          const barangRef = doc(db, 'barang', item.barangId);
          const barangDoc = await transaction.get(barangRef);

          if (!barangDoc.exists()) {
            throw new Error(`Barang "${item.namaBarang}" tidak ditemukan di master katalog.`);
          }

          const currentStock = typeof barangDoc.data().stok === 'number' ? barangDoc.data().stok : 0;

          // Cek kecukupan stok secara atomik
          if (currentStock < item.jumlah) {
            throw new Error(
              `Stok "${item.namaBarang}" tidak mencukupi! Sisa stok gudang: ${currentStock} ${item.satuan}, diminta: ${item.jumlah} ${item.satuan}.`
            );
          }

          barangReads.push({
            item,
            docRef: barangRef,
            currentStock,
          });
        }

        // Cek kembali status dokumen permintaan untuk menjamin idempotensi
        const permintaanRef = doc(db, 'permintaan', permintaan.id);
        const permintaanDoc = await transaction.get(permintaanRef);

        if (!permintaanDoc.exists()) {
          throw new Error('Dokumen pengajuan tidak ditemukan di database.');
        }

        if (permintaanDoc.data().status !== 'Menunggu Persetujuan') {
          throw new Error(
            `Pengajuan ini telah diproses sebelumnya (Status saat ini: ${permintaanDoc.data().status}).`
          );
        }

        // ==========================================================
        // TAHAP 2: PENULISAN ATOMIK (WRITES)
        // ==========================================================
        const now = serverTimestamp();
        const adminUid = auth.currentUser?.uid || 'admin';
        const adminEmail = auth.currentUser?.email || profile?.email || 'admin@kantor.com';

        // 1. Kurangi stok barang & tulis audit trail riwayat_stok
        for (const { item, docRef, currentStock } of barangReads) {
          const newStock = currentStock - item.jumlah;

          // (a) Potong stok di master barang
          transaction.update(docRef, {
            stok: newStock,
            updatedAt: now,
          });

          // (b) Catat riwayat_stok (Audit trail PRD)
          const riwayatRef = doc(collection(db, 'riwayat_stok'));
          transaction.set(riwayatRef, {
            barangId: item.barangId,
            namaBarang: item.namaBarang,
            tipe: 'Permintaan Pegawai',
            perubahan: -item.jumlah,
            stokSebelum: currentStock,
            stokAkhir: newStock,
            permintaanId: permintaan.id,
            pelakuId: adminUid,
            pelakuEmail: adminEmail,
            penerimaNama: permintaan.namaPegawai,
            divisi: permintaan.divisi || 'Umum',
            timestamp: now,
            keterangan: `Pengeluaran barang disetujui untuk ${permintaan.namaPegawai} (${permintaan.divisi})`,
          });
        }

        // 2. Ubah status permintaan menjadi "Disiapkan"
        transaction.update(permintaanRef, {
          status: 'Disiapkan',
          approvedAt: now,
          approvedBy: adminUid,
          approvedByEmail: adminEmail,
        });
      });

      showToast(`✅ Permintaan dari ${permintaan.namaPegawai} berhasil disetujui! Stok telah dipotong.`);
    } catch (err: any) {
      console.error('[APPROVE ERROR]:', err);
      showToast(`❌ ${err.message || 'Gagal memproses transaksi persetujuan.'}`, 'error');
    } finally {
      setApprovingId(null);
    }
  };

  // ----------------------------------------------------
  // Handler Penolakan (Reject)
  // ----------------------------------------------------
  const handleConfirmReject = async () => {
    if (!rejectModal) return;

    setIsRejecting(true);
    try {
      const permintaanRef = doc(db, 'permintaan', rejectModal.id);
      await updateDoc(permintaanRef, {
        status: 'Ditolak',
        alasanPenolakan: alasanPenolakan.trim() || 'Tidak memenuhi kriteria / Stok dialokasikan untuk kebutuhan mendesak.',
        rejectedAt: serverTimestamp(),
        rejectedBy: auth.currentUser?.uid || 'admin',
        rejectedByEmail: auth.currentUser?.email || profile?.email || 'admin@kantor.com',
      });

      showToast(`Permintaan dari ${rejectModal.namaPegawai} telah ditolak.`);
      setRejectModal(null);
      setAlasanPenolakan('');
    } catch (err: any) {
      console.error('Error rejecting permintaan:', err);
      showToast(`Gagal menolak permintaan: ${err.message}`, 'error');
    } finally {
      setIsRejecting(false);
    }
  };

  // ----------------------------------------------------
  // Filter & Statistik
  // ----------------------------------------------------
  const counts = {
    menunggu: permintaanList.filter((p) => p.status === 'Menunggu Persetujuan').length,
    disiapkan: permintaanList.filter((p) => p.status === 'Disiapkan').length,
    total: permintaanList.length,
  };

  const filteredPermintaan = permintaanList.filter((p) => {
    // Filter tab
    if (activeTab === 'Menunggu' && p.status !== 'Menunggu Persetujuan') return false;
    if (activeTab === 'Disiapkan' && p.status !== 'Disiapkan') return false;

    // Filter search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = p.namaPegawai.toLowerCase().includes(q);
      const matchDivisi = p.divisi?.toLowerCase().includes(q);
      const matchItem = p.items.some((i) => i.namaBarang.toLowerCase().includes(q));
      return matchName || matchDivisi || matchItem;
    }

    return true;
  });

  // Format Tanggal
  const formatTanggal = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-xl text-sm font-medium shadow-2xl flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-3 ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-slate-900 text-white border border-slate-700'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} className="text-emerald-400" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* HEADER UTAMA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Inbox size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Persetujuan Permintaan Barang</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Verifikasi dan setujui permohonan ATK/barang habis pakai dari pegawai
              </p>
            </div>
          </div>
        </div>

        {/* Indikator Status & Real-time Live Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync Firestore
          </div>
        </div>
      </div>

      {/* STAT CARDS / TABS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTab('Menunggu')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            activeTab === 'Menunggu'
              ? 'bg-white border-amber-300 ring-2 ring-amber-400/20 shadow-md'
              : 'bg-white/80 border-slate-200 hover:bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Menunggu Persetujuan</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-amber-600">{counts.menunggu}</p>
          <p className="text-xs text-slate-400 mt-1">Perlu tindakan verifikasi & approve</p>
        </button>

        <button
          onClick={() => setActiveTab('Disiapkan')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            activeTab === 'Disiapkan'
              ? 'bg-white border-blue-300 ring-2 ring-blue-400/20 shadow-md'
              : 'bg-white/80 border-slate-200 hover:bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Telah Disetujui (Disiapkan)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <PackageCheck size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-blue-600">{counts.disiapkan}</p>
          <p className="text-xs text-slate-400 mt-1">Stok terpotong, siap diantar petugas</p>
        </button>

        <button
          onClick={() => setActiveTab('Semua')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            activeTab === 'Semua'
              ? 'bg-white border-indigo-300 ring-2 ring-indigo-400/20 shadow-md'
              : 'bg-white/80 border-slate-200 hover:bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Semua Riwayat Permintaan</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-800">{counts.total}</p>
          <p className="text-xs text-slate-400 mt-1">Total pengajuan yang tercatat di sistem</p>
        </button>
      </div>

      {/* FILTER SEARCH BAR */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama pegawai, divisi, atau nama barang..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
      </div>

      {/* TABEL / DAFTAR PERMINTAAN */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <RotateCw size={28} className="animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-medium text-slate-600">Memuat data permintaan dari Firestore...</p>
          </div>
        ) : filteredPermintaan.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Inbox size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-base font-semibold text-slate-700">Tidak ada pengajuan ditemukan</p>
            <p className="text-sm text-slate-400 mt-1">
              {search
                ? `Tidak ada data yang cocok dengan "${search}".`
                : activeTab === 'Menunggu'
                ? 'Semua permintaan telah diproses! Tidak ada antrean persetujuan.'
                : 'Belum ada data permintaan barang.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPermintaan.map((req) => {
              const isExpanded = expandedId === req.id || req.status === 'Menunggu Persetujuan';
              const isPending = req.status === 'Menunggu Persetujuan';
              const isApproving = approvingId === req.id;

              // Cek apakah ada barang yang stok gudangnya kurang dari yang diminta
              const hasInsufficientStock = req.items.some((item) => {
                const liveStock = masterBarangMap[item.barangId]?.stok ?? 0;
                return liveStock < item.jumlah;
              });

              return (
                <div key={req.id} className="p-6 transition-colors hover:bg-slate-50/50">
                  {/* Baris Ringkasan Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                        {req.namaPegawai ? req.namaPegawai[0]?.toUpperCase() : 'P'}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base">{req.namaPegawai}</h3>
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                            <Building size={11} /> {req.divisi || 'Umum'}
                          </span>

                          {/* Status Badge */}
                          {req.status === 'Menunggu Persetujuan' ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                              <Clock size={11} /> Menunggu Persetujuan
                            </span>
                          ) : req.status === 'Disiapkan' ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                              <PackageCheck size={11} /> Disiapkan
                            </span>
                          ) : req.status === 'Ditolak' ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 font-semibold border border-red-200">
                              <XCircle size={11} /> Ditolak
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                              <CheckCircle2 size={11} /> {req.status}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> {formatTanggal(req.tanggalPengajuan)}
                          </span>
                          <span>•</span>
                          <span>
                            Total: <strong className="text-slate-800">{req.items.length}</strong> jenis barang (
                            <strong className="text-slate-800">{req.items.reduce((acc, i) => acc + i.jumlah, 0)}</strong> unit)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tombol Aksi Persetujuan */}
                    <div className="flex items-center gap-2 self-end lg:self-center">
                      {/* Tombol Lacak Riwayat Pengantaran */}
                      <button
                        onClick={() => setTrackingPermintaan(req)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm"
                        title="Lacak Riwayat Pengantaran"
                      >
                        <Truck size={14} className="text-blue-600" />
                        <span>Lacak</span>
                      </button>

                      {isPending && (
                        <>
                          <button
                            onClick={() => setRejectModal({ id: req.id, namaPegawai: req.namaPegawai })}
                            disabled={isApproving}
                            className="px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-200"
                          >
                            Tolak
                          </button>

                          <button
                            onClick={() => handleApprove(req)}
                            disabled={isApproving || hasInsufficientStock}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all shadow-sm ${
                              hasInsufficientStock
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                : isApproving
                                ? 'bg-blue-400 text-white cursor-wait'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                            }`}
                          >
                            {isApproving ? (
                              <>
                                <RotateCw size={13} className="animate-spin" />
                                <span>Memproses Transaksi...</span>
                              </>
                            ) : hasInsufficientStock ? (
                              <>
                                <AlertTriangle size={13} className="text-amber-500" />
                                <span>Stok Tidak Cukup</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={13} />
                                <span>Setujui Permintaan</span>
                              </>
                            )}
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : req.id)}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Keterangan Catatan Pengajuan (Jika Ada) */}
                  {req.catatan ? (
                    <div className="mt-3 text-xs bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-slate-600">
                      <span className="font-semibold text-slate-800">Catatan Pegawai:</span> &ldquo;{req.catatan}&rdquo;
                    </div>
                  ) : null}

                  {/* Catatan Penolakan (Jika Ada) */}
                  {req.alasanPenolakan ? (
                    <div className="mt-3 text-xs bg-red-50 border border-red-200 rounded-xl p-3 text-red-700">
                      <span className="font-semibold">Alasan Penolakan:</span> {req.alasanPenolakan}
                    </div>
                  ) : null}

                  {/* RINCIAN TABEL ITEM BARANG (Expandable / Auto-open on Pending) */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                        Rincian Barang yang Diminta:
                      </p>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-slate-100 rounded-xl overflow-hidden">
                          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                            <tr>
                              <th className="py-2.5 px-3.5">Nama Barang</th>
                              <th className="py-2.5 px-3.5">Kategori</th>
                              <th className="py-2.5 px-3.5 text-center">Jumlah Diminta</th>
                              <th className="py-2.5 px-3.5 text-center">Stok Gudang Saat Ini</th>
                              <th className="py-2.5 px-3.5 text-center">Status Stok</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {req.items.map((item, idx) => {
                              const liveStock = masterBarangMap[item.barangId]?.stok ?? 0;
                              const isStockShortage = liveStock < item.jumlah;

                              return (
                                <tr key={idx} className={isStockShortage ? 'bg-red-50/40' : 'hover:bg-slate-50/40'}>
                                  <td className="py-2.5 px-3.5 font-semibold text-slate-800">{item.namaBarang}</td>
                                  <td className="py-2.5 px-3.5 text-slate-500">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-medium">
                                      {item.kategori}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3.5 text-center font-bold text-slate-800">
                                    {item.jumlah} {item.satuan}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-center font-semibold text-slate-600">
                                    {liveStock} {item.satuan}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-center">
                                    {isStockShortage ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                        <AlertTriangle size={11} /> Kurang ({item.jumlah - liveStock} {item.satuan})
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                        <CheckCircle2 size={11} /> Cukup
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL TOLAK PERMINTAAN */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2 bg-red-100 rounded-xl">
                <XCircle size={22} />
              </div>
              <h3 className="font-bold text-base text-slate-900">Tolak Permintaan Barang</h3>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Anda akan menolak pengajuan barang dari <strong className="text-slate-800">{rejectModal.namaPegawai}</strong>.
              Stok barang di gudang tidak akan dipotong. Masukkan alasan penolakan:
            </p>

            <textarea
              rows={3}
              placeholder="Contoh: Stok sedang dialokasikan untuk kebutuhan mendesak / Mohon ajukan kembali minggu depan."
              value={alasanPenolakan}
              onChange={(e) => setAlasanPenolakan(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
            />

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setRejectModal(null);
                  setAlasanPenolakan('');
                }}
                disabled={isRejecting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isRejecting}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-colors"
              >
                {isRejecting ? 'Menolak...' : 'Konfirmasi Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TIMELINE LACAK PENGANTARAN (DELIVERY LOGS) */}
      {trackingPermintaan && (
        <TrackingModal
          permintaan={trackingPermintaan}
          onClose={() => setTrackingPermintaan(null)}
        />
      )}
    </div>
  );
}
