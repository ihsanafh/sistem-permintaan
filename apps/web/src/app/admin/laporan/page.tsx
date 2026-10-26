'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  User,
  Package,
  Layers,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  TrendingDown,
  Building,
  RotateCw,
} from 'lucide-react';

interface PermintaanItem {
  barangId: string;
  namaBarang: string;
  kategori: string;
  satuan: string;
  jumlah: number;
}

interface Permintaan {
  id: string;
  pegawaiId: string;
  namaPegawai: string;
  emailPegawai?: string;
  divisi?: string;
  status: string;
  tanggalPengajuan?: any;
  createdAt?: any;
  approvedAt?: any;
  waktuDiterima?: any;
  waktuSelesai?: any;
  items: PermintaanItem[];
  totalKuantitas?: number;
  catatan?: string;
}

const BULAN_LIST = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

export default function LaporanPage() {
  const currentDate = new Date();
  const [selectedBulan, setSelectedBulan] = useState<number>(currentDate.getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState<number>(currentDate.getFullYear());
  const [selectedPegawai, setSelectedPegawai] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('dikeluarkan'); // 'dikeluarkan' | 'selesai' | 'all'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'barang' | 'pegawai' | 'detail'>('barang');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Raw data from Firestore
  const [permintaanList, setPermintaanList] = useState<Permintaan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Real-time listener for permintaan
  useEffect(() => {
    const q = query(collection(db, 'permintaan'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Permintaan[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          docs.push({
            id: docSnap.id,
            pegawaiId: data.pegawaiId || data.userId || '',
            namaPegawai: data.namaPegawai || 'Pegawai',
            emailPegawai: data.emailPegawai || '',
            divisi: data.divisi || 'Umum',
            status: data.status || 'Menunggu Persetujuan',
            tanggalPengajuan: data.tanggalPengajuan || data.createdAt,
            createdAt: data.createdAt,
            approvedAt: data.approvedAt,
            waktuDiterima: data.waktuDiterima,
            waktuSelesai: data.waktuSelesai,
            items: Array.isArray(data.items) ? data.items : [],
            totalKuantitas: data.totalKuantitas || 0,
            catatan: data.catatan || '',
          });
        });
        setPermintaanList(docs);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching permintaan for laporan:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Daftar pegawai unik untuk dropdown filter
  const pegawaiOptions = useMemo(() => {
    const map = new Map<string, { id: string; nama: string; divisi: string }>();
    permintaanList.forEach((p) => {
      if (p.pegawaiId && p.namaPegawai) {
        if (!map.has(p.pegawaiId)) {
          map.set(p.pegawaiId, {
            id: p.pegawaiId,
            nama: p.namaPegawai,
            divisi: p.divisi || 'Umum',
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [permintaanList]);

  // Helper konversi Firestore Timestamp ke Date
  const parseDate = (ts: any): Date | null => {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  };

  // Filter permintaan berdasarkan Bulan, Tahun, Pegawai, Status, dan Pencarian
  const filteredPermintaan = useMemo(() => {
    return permintaanList.filter((p) => {
      // 1. Tentukan tanggal acuan transaksi (prioritas: approvedAt -> waktuDiterima -> createdAt)
      const date = parseDate(p.approvedAt || p.waktuDiterima || p.createdAt || p.tanggalPengajuan);
      if (!date) return false;

      const matchesBulan = date.getMonth() + 1 === selectedBulan;
      const matchesTahun = date.getFullYear() === selectedTahun;
      if (!matchesBulan || !matchesTahun) return false;

      // 2. Filter Pegawai
      if (selectedPegawai !== 'all' && p.pegawaiId !== selectedPegawai) {
        return false;
      }

      // 3. Filter Status Pengeluaran
      if (selectedStatus === 'dikeluarkan') {
        // Status yang dianggap pengeluaran barang resmi: Disiapkan, Diterima, Diterima (Otomatis)
        if (!['Disiapkan', 'Diterima', 'Diterima (Otomatis)'].includes(p.status)) {
          return false;
        }
      } else if (selectedStatus === 'selesai') {
        // Hanya yang tuntas diterima fisik
        if (!['Diterima', 'Diterima (Otomatis)'].includes(p.status)) {
          return false;
        }
      }

      // 4. Filter Pencarian Text
      if (searchQuery.trim()) {
        const qClean = searchQuery.toLowerCase();
        const matchPegawai = p.namaPegawai.toLowerCase().includes(qClean);
        const matchDivisi = (p.divisi || '').toLowerCase().includes(qClean);
        const matchItem = p.items.some(
          (i) => i.namaBarang.toLowerCase().includes(qClean) || i.kategori.toLowerCase().includes(qClean)
        );
        if (!matchPegawai && !matchDivisi && !matchItem) return false;
      }

      return true;
    });
  }, [permintaanList, selectedBulan, selectedTahun, selectedPegawai, selectedStatus, searchQuery]);

  // ========================================================
  // AGREGASI 1: Rekapitulasi per Barang (Akumulasi Pengeluaran)
  // ========================================================
  const rekapBarang = useMemo(() => {
    const map = new Map<
      string,
      {
        barangId: string;
        namaBarang: string;
        kategori: string;
        satuan: string;
        totalJumlah: number;
        frekuensi: number;
        pegawaiMap: Map<string, { nama: string; divisi: string; qty: number }>;
      }
    >();

    filteredPermintaan.forEach((p) => {
      p.items.forEach((item) => {
        const key = item.barangId || item.namaBarang;
        let entry = map.get(key);
        if (!entry) {
          entry = {
            barangId: item.barangId,
            namaBarang: item.namaBarang,
            kategori: item.kategori,
            satuan: item.satuan,
            totalJumlah: 0,
            frekuensi: 0,
            pegawaiMap: new Map(),
          };
          map.set(key, entry);
        }

        entry.totalJumlah += item.jumlah;
        entry.frekuensi += 1;

        const pKey = p.pegawaiId || p.namaPegawai;
        const currentP = entry.pegawaiMap.get(pKey);
        if (!currentP) {
          entry.pegawaiMap.set(pKey, {
            nama: p.namaPegawai,
            divisi: p.divisi || 'Umum',
            qty: item.jumlah,
          });
        } else {
          currentP.qty += item.jumlah;
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalJumlah - a.totalJumlah);
  }, [filteredPermintaan]);

  // ========================================================
  // AGREGASI 2: Rekapitulasi per Pegawai Penerima
  // ========================================================
  const rekapPegawai = useMemo(() => {
    const map = new Map<
      string,
      {
        pegawaiId: string;
        namaPegawai: string;
        divisi: string;
        totalKuantitas: number;
        frekuensi: number;
        itemsMap: Map<string, { nama: string; satuan: string; qty: number }>;
      }
    >();

    filteredPermintaan.forEach((p) => {
      const key = p.pegawaiId || p.namaPegawai;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          pegawaiId: p.pegawaiId,
          namaPegawai: p.namaPegawai,
          divisi: p.divisi || 'Umum',
          totalKuantitas: 0,
          frekuensi: 0,
          itemsMap: new Map(),
        };
        map.set(key, entry);
      }

      entry.frekuensi += 1;
      p.items.forEach((item) => {
        entry.totalKuantitas += item.jumlah;
        const itemKey = item.barangId || item.namaBarang;
        const currentItem = entry.itemsMap.get(itemKey);
        if (!currentItem) {
          entry.itemsMap.set(itemKey, {
            nama: item.namaBarang,
            satuan: item.satuan,
            qty: item.jumlah,
          });
        } else {
          currentItem.qty += item.jumlah;
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalKuantitas - a.totalKuantitas);
  }, [filteredPermintaan]);

  // Ringkasan KPI Cards
  const totalItemDisbursed = useMemo(() => {
    return rekapBarang.reduce((acc, curr) => acc + curr.totalJumlah, 0);
  }, [rekapBarang]);

  const namaBulanTerpilih = BULAN_LIST.find((b) => b.value === selectedBulan)?.label || '';

  // ========================================================
  // FUNGSI EKSPOR EXCEL REKAP RESMI (SIAP CETAK & TANDATANGAN)
  // ========================================================
  const handleExportExcel = () => {
    setIsExporting(true);

    try {
      const wb = XLSX.utils.book_new();
      const namaPegawaiFilter =
        selectedPegawai === 'all'
          ? 'Semua Pegawai'
          : pegawaiOptions.find((p) => p.id === selectedPegawai)?.nama || selectedPegawai;

      const tanggalCetakStr = new Date().toLocaleString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // ----------------------------------------------------
      // SHEET 1: REKAPITULASI AKUMULASI PENGELUARAN BARANG
      // ----------------------------------------------------
      const sheet1Data: any[] = [
        ['SISTEM MANAJEMEN PERMINTAAN & LOGISTIK INTERNAL'],
        ['LAPORAN REKAPITULASI AKUMULASI PENGELUARAN BARANG'],
        [`Periode: ${namaBulanTerpilih} ${selectedTahun}`],
        [`Filter Pegawai: ${namaPegawaiFilter} | Status: ${selectedStatus.toUpperCase()}`],
        [`Tanggal Cetak: ${tanggalCetakStr}`],
        [], // Baris kosong pemisah
        [
          'NO',
          'NAMA BARANG',
          'KATEGORI',
          'SATUAN',
          'TOTAL PENGELUARAN',
          'FREKUENSI PERMINTAAN',
          'PEGAWAI PENERIMA TERBANYAK',
        ],
      ];

      rekapBarang.forEach((item, index) => {
        // Cari pegawai penerima terbanyak untuk barang ini
        const topPegawai = Array.from(item.pegawaiMap.values()).sort((a, b) => b.qty - a.qty)[0];
        const topStr = topPegawai ? `${topPegawai.nama} (${topPegawai.qty} ${item.satuan})` : '-';

        sheet1Data.push([
          index + 1,
          item.namaBarang,
          item.kategori,
          item.satuan,
          item.totalJumlah,
          item.frekuensi,
          topStr,
        ]);
      });

      // Total Baris
      sheet1Data.push([
        '',
        'TOTAL KESELURUHAN',
        '',
        '',
        totalItemDisbursed,
        filteredPermintaan.length,
        '',
      ]);

      // Blok Tanda Tangan Resmi
      sheet1Data.push(
        [],
        [],
        ['', 'Mengetahui & Menyetujui,', '', '', 'Pengelola Inventori,', '', 'Penerima Rekapitulasi,'],
        ['', 'Kepala Divisi / Supervisor', '', '', 'Staff Pengelola Gudang', '', 'Departemen General Affairs'],
        [],
        [],
        [],
        ['', '( .................................... )', '', '', '( .................................... )', '', '( .................................... )'],
        ['', 'NIP: ..............................', '', '', 'NIP: ..............................', '', 'NIP: ..............................']
      );

      const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
      ws1['!cols'] = [
        { wch: 6 },
        { wch: 35 },
        { wch: 18 },
        { wch: 12 },
        { wch: 20 },
        { wch: 22 },
        { wch: 35 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, 'Akumulasi Barang');

      // ----------------------------------------------------
      // SHEET 2: REKAPITULASI PENGELUARAN PER PEGAWAI
      // ----------------------------------------------------
      const sheet2Data: any[] = [
        ['SISTEM MANAJEMEN PERMINTAAN & LOGISTIK INTERNAL'],
        ['LAPORAN REKAPITULASI PENGELUARAN BARANG PER PEGAWAI'],
        [`Periode: ${namaBulanTerpilih} ${selectedTahun}`],
        [`Tanggal Cetak: ${tanggalCetakStr}`],
        [],
        ['NO', 'NAMA PEGAWAI', 'DIVISI', 'TOTAL BARANG (QTY)', 'FREKUENSI PENGAJUAN', 'RINCIAN ITEM BARANG'],
      ];

      rekapPegawai.forEach((p, index) => {
        const itemDetailsStr = Array.from(p.itemsMap.values())
          .map((i) => `${i.nama} (${i.qty} ${i.satuan})`)
          .join(', ');

        sheet2Data.push([
          index + 1,
          p.namaPegawai,
          p.divisi,
          p.totalKuantitas,
          p.frekuensi,
          itemDetailsStr,
        ]);
      });

      // Blok Tanda Tangan
      sheet2Data.push(
        [],
        [],
        ['', 'Mengetahui & Menyetujui,', '', '', 'Pengelola Inventori,'],
        ['', 'Kepala Divisi / Supervisor', '', '', 'Staff Pengelola Gudang'],
        [],
        [],
        [],
        ['', '( .................................... )', '', '', '( .................................... )'],
        ['', 'NIP: ..............................', '', '', 'NIP: ..............................']
      );

      const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
      ws2['!cols'] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 18 },
        { wch: 20 },
        { wch: 22 },
        { wch: 60 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Rekap per Pegawai');

      // ----------------------------------------------------
      // SHEET 3: LOG RINCIAN DETAIL TRANSAKSI
      // ----------------------------------------------------
      const sheet3Data: any[] = [
        ['SISTEM MANAJEMEN PERMINTAAN & LOGISTIK INTERNAL'],
        ['RINCIAN DETAIL TRANSAKSI PENGELUARAN BARANG'],
        [`Periode: ${namaBulanTerpilih} ${selectedTahun}`],
        [`Tanggal Cetak: ${tanggalCetakStr}`],
        [],
        [
          'NO',
          'ID PENGAJUAN',
          'TANGGAL',
          'NAMA PEGAWAI',
          'DIVISI',
          'NAMA BARANG',
          'KATEGORI',
          'JUMLAH',
          'SATUAN',
          'STATUS',
          'CATATAN',
        ],
      ];

      let rowNo = 1;
      filteredPermintaan.forEach((p) => {
        const d = parseDate(p.approvedAt || p.waktuDiterima || p.createdAt);
        const tglStr = d
          ? d.toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '-';

        p.items.forEach((item) => {
          sheet3Data.push([
            rowNo++,
            p.id,
            tglStr,
            p.namaPegawai,
            p.divisi || 'Umum',
            item.namaBarang,
            item.kategori,
            item.jumlah,
            item.satuan,
            p.status,
            p.catatan || '-',
          ]);
        });
      });

      const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
      ws3['!cols'] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 15 },
        { wch: 24 },
        { wch: 16 },
        { wch: 30 },
        { wch: 16 },
        { wch: 10 },
        { wch: 10 },
        { wch: 20 },
        { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, ws3, 'Log Detail Transaksi');

      // Download berkas
      const fileName = `Laporan_Rekap_Pengeluaran_${namaBulanTerpilih}_${selectedTahun}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      console.error('Error exporting excel:', err);
      alert(`Gagal mengekspor data ke Excel: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-7">
      {/* HEADER UTAMA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Laporan & Rekapitulasi Pengeluaran
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Akumulasi distribusi barang bulanan dan arsip fisik siap cetak dan tandatangan
              </p>
            </div>
          </div>
        </div>

        {/* Tombol Ekspor Excel */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            disabled={isExporting || rekapBarang.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <RotateCw size={15} className="animate-spin" />
                <span>Mengekspor Excel...</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>Ekspor Rekap Excel (Siap TTD)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs border-b border-slate-100 pb-3">
          <Filter size={15} className="text-blue-600" />
          <span>Filter Laporan & Parameter Waktu</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Filter Bulan */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" /> Bulan Periode
            </label>
            <select
              value={selectedBulan}
              onChange={(e) => setSelectedBulan(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {BULAN_LIST.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Tahun */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" /> Tahun
            </label>
            <select
              value={selectedTahun}
              onChange={(e) => setSelectedTahun(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Pegawai */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
              <User size={13} className="text-slate-400" /> Filter Pegawai
            </label>
            <select
              value={selectedPegawai}
              onChange={(e) => setSelectedPegawai(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Pegawai ({pegawaiOptions.length} Orang)</option>
              {pegawaiOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.divisi})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-slate-400" /> Cakupan Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="dikeluarkan">Semua Barang Dikeluarkan (Disiapkan/Diterima)</option>
              <option value="selesai">Hanya Tuntas Diterima (Manual/Otomatis)</option>
              <option value="all">Semua Data (Termasuk Menunggu & Ditolak)</option>
            </select>
          </div>
        </div>

        {/* Pencarian Cepat */}
        <div className="pt-2">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari cepat nama barang, nama pegawai, atau divisi..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Qty */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Barang Dikeluarkan</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {totalItemDisbursed.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-blue-600 font-medium mt-0.5">
              Periode {namaBulanTerpilih} {selectedTahun}
            </p>
          </div>
        </div>

        {/* Card 2: Jenis SKU Barang */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Jenis SKU Terdistribusi</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{rekapBarang.length} Item</p>
            <p className="text-[11px] text-indigo-600 font-medium mt-0.5">Katalog unik diambil</p>
          </div>
        </div>

        {/* Card 3: Pegawai Penerima */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <User size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Pegawai Penerima</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{rekapPegawai.length} Orang</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Penerima barang fisik</p>
          </div>
        </div>

        {/* Card 4: Total Transaksi Pengajuan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Dokumen Permintaan</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {filteredPermintaan.length} Pengajuan
            </p>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">Selesai / Terproses</p>
          </div>
        </div>
      </div>

      {/* TABS VIEW & DATA TABLES */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('barang')}
            className={`pb-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'barang'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Package size={15} />
            <span>Rekapitulasi per Barang ({rekapBarang.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pegawai')}
            className={`pb-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'pegawai'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <User size={15} />
            <span>Rekapitulasi per Pegawai ({rekapPegawai.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('detail')}
            className={`pb-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'detail'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText size={15} />
            <span>Rincian Pengajuan ({filteredPermintaan.length})</span>
          </button>
        </div>

        {/* TAB 1: REKAPITULASI BARANG */}
        {activeTab === 'barang' && (
          <div className="overflow-x-auto">
            {rekapBarang.length === 0 ? (
              <div className="py-16 text-center">
                <Package size={40} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Tidak ada pengeluaran barang</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tidak ditemukan data transaksi pengeluaran barang pada periode {namaBulanTerpilih}{' '}
                  {selectedTahun}.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-6 w-12 text-center">No</th>
                    <th className="py-3.5 px-6">Nama Barang</th>
                    <th className="py-3.5 px-6">Kategori</th>
                    <th className="py-3.5 px-6 text-right">Total Dikeluarkan</th>
                    <th className="py-3.5 px-6 text-center">Frekuensi</th>
                    <th className="py-3.5 px-6">Penerima Terbanyak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rekapBarang.map((item, idx) => {
                    const topPegawai = Array.from(item.pegawaiMap.values()).sort(
                      (a, b) => b.qty - a.qty
                    )[0];

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-6 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-3.5 px-6 font-semibold text-slate-900">{item.namaBarang}</td>
                        <td className="py-3.5 px-6">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[11px] font-medium text-slate-600">
                            {item.kategori}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right font-bold text-blue-600 text-sm">
                          {item.totalJumlah} <span className="text-xs font-normal text-slate-500">{item.satuan}</span>
                        </td>
                        <td className="py-3.5 px-6 text-center font-medium">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px]">
                            {item.frekuensi} kali
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-slate-600">
                          {topPegawai ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-800">{topPegawai.nama}</span>
                              <span className="text-slate-400">({topPegawai.divisi})</span>
                              <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold">
                                {topPegawai.qty} {item.satuan}
                              </span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: REKAPITULASI PEGAWAI */}
        {activeTab === 'pegawai' && (
          <div className="overflow-x-auto">
            {rekapPegawai.length === 0 ? (
              <div className="py-16 text-center">
                <User size={40} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Tidak ada pengajuan pegawai</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Belum ada pegawai yang mengambil barang pada periode {namaBulanTerpilih} {selectedTahun}.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-6 w-12 text-center">No</th>
                    <th className="py-3.5 px-6">Nama Pegawai</th>
                    <th className="py-3.5 px-6">Divisi</th>
                    <th className="py-3.5 px-6 text-center">Frekuensi Permintaan</th>
                    <th className="py-3.5 px-6 text-right">Total Barang (Kuantitas)</th>
                    <th className="py-3.5 px-6">Rincian Barang Diambil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rekapPegawai.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 text-center text-slate-400">{idx + 1}</td>
                      <td className="py-3.5 px-6 font-bold text-slate-900">{p.namaPegawai}</td>
                      <td className="py-3.5 px-6 text-slate-600">
                        <span className="flex items-center gap-1">
                          <Building size={13} className="text-slate-400" />
                          {p.divisi}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-semibold">
                          {p.frekuensi} Pengajuan
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold text-emerald-600 text-sm">
                        {p.totalKuantitas} <span className="text-xs font-normal text-slate-500">Unit/Pcs</span>
                      </td>
                      <td className="py-3.5 px-6 max-w-md">
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from(p.itemsMap.values()).map((itm, iIdx) => (
                            <span
                              key={iIdx}
                              className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[11px] text-slate-700"
                            >
                              {itm.nama}: <strong>{itm.qty} {itm.satuan}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: DETAIL DOKUMEN PENGAJUAN */}
        {activeTab === 'detail' && (
          <div className="overflow-x-auto">
            {filteredPermintaan.length === 0 ? (
              <div className="py-16 text-center">
                <FileText size={40} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Tidak ada dokumen pengajuan</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tidak ada dokumen permintaan sesuai kriteria pencarian dan filter Anda.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-6 w-12 text-center">No</th>
                    <th className="py-3.5 px-6">Tanggal</th>
                    <th className="py-3.5 px-6">Nama Pegawai & Divisi</th>
                    <th className="py-3.5 px-6">Barang yang Diminta</th>
                    <th className="py-3.5 px-6 text-center">Status</th>
                    <th className="py-3.5 px-6">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredPermintaan.map((p, idx) => {
                    const d = parseDate(p.approvedAt || p.waktuDiterima || p.createdAt);
                    const tgl = d
                      ? d.toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-';

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-6 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-3.5 px-6 whitespace-nowrap text-slate-600 font-medium">{tgl}</td>
                        <td className="py-3.5 px-6">
                          <p className="font-bold text-slate-900">{p.namaPegawai}</p>
                          <p className="text-[11px] text-slate-500">{p.divisi || 'Umum'}</p>
                        </td>
                        <td className="py-3.5 px-6">
                          <ul className="space-y-0.5">
                            {p.items.map((i, iIdx) => (
                              <li key={iIdx} className="text-slate-700">
                                • <span className="font-semibold">{i.namaBarang}</span> ({i.jumlah} {i.satuan})
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="py-3.5 px-6 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              p.status === 'Diterima'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.status === 'Diterima (Otomatis)'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : p.status === 'Disiapkan'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {p.status === 'Diterima' && <CheckCircle2 size={12} />}
                            {p.status === 'Diterima (Otomatis)' && <Clock size={12} />}
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-slate-500 italic max-w-xs truncate">
                          {p.catatan || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
