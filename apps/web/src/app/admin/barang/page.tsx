'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit2,
  PowerOff,
  Power,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  AlertTriangle,
  Package,
  UploadCloud,
  ClipboardList,
  Download,
  CheckCircle2,
  RotateCw,
  Save,
  FileSpreadsheet,
  Info,
  ArrowUpDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';

// ==========================================
// 1. Tipe Data
// ==========================================
interface Barang {
  id: string;
  nama: string;
  kategori: string;
  satuan: string;
  stok: number;
  aktif: boolean;
}

// ==========================================
// 2. API Helper
// ==========================================
async function fetchBarang(cursor: string | null, search: string) {
  const params = new URLSearchParams({ limit: '30' });
  if (cursor) params.set('after', cursor);
  if (search) params.set('search', search);
  const res = await fetch(`/api/barang?${params}`);
  if (!res.ok) throw new Error('Gagal memuat data barang');
  return res.json() as Promise<{ items: Barang[]; nextCursor: string | null }>;
}

// ==========================================
// 3. Modal Tambah / Edit Barang Tunggal
// ==========================================
function BarangModal({
  initial,
  onClose,
  onSave,
  loading,
}: {
  initial?: Partial<Barang>;
  onClose: () => void;
  onSave: (data: Partial<Barang>, keepOpen?: boolean, resetCb?: () => void) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    nama: initial?.nama || '',
    kategori: initial?.kategori || '',
    satuan: initial?.satuan || '',
    stokAwal: initial ? undefined : '0',
  });
  const [err, setErr] = useState('');
  const isEdit = !!initial?.id;
  const namaInputRef = useRef<HTMLInputElement>(null);

  function validate() {
    if (!form.nama.trim() || !form.kategori.trim() || !form.satuan.trim()) {
      setErr('Nama, kategori, dan satuan wajib diisi.');
      return false;
    }
    if (!isEdit) {
      const stok = parseInt(form.stokAwal || '0', 10);
      if (isNaN(stok) || stok < 0 || !Number.isInteger(stok)) {
        setErr('Stok awal harus bilangan bulat non-negatif.');
        return false;
      }
    }
    setErr('');
    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSave({ ...form }, false);
  }

  function handleSaveAndAddAnother(e: React.MouseEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSave({ ...form }, true, () => {
      setForm({
        nama: '',
        kategori: '',
        satuan: '',
        stokAwal: '0',
      });
      setErr('');
      setTimeout(() => {
        namaInputRef.current?.focus();
      }, 50);
    });
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">{isEdit ? 'Edit Barang' : 'Tambah Barang Baru'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm border border-red-200">
              <AlertCircle size={15} /> {err}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Barang</label>
            <input
              ref={namaInputRef}
              type="text"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="cth: Kertas A4 80gsm"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kategori</label>
              <input
                type="text"
                value={form.kategori}
                onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                placeholder="cth: ATK"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Satuan</label>
              <input
                type="text"
                value={form.satuan}
                onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                placeholder="cth: Rim / Pcs"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Stok Awal</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stokAwal}
                onChange={(e) => setForm({ ...form, stokAwal: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">Stok awal akan dicatat otomatis ke audit riwayat_stok.</p>
            </div>
          )}
          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            {!isEdit && (
              <button
                type="button"
                onClick={handleSaveAndAddAnother}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                <span>Simpan & Tambah Lagi</span>
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-60"
            >
              {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Barang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 4. Modal Upload Excel (Import Baru / Master Data / Restock)
// ==========================================
function ExcelUploadModal({
  mode,
  onClose,
  onSuccess,
  currentItems,
}: {
  mode: 'import-new' | 'master-data' | 'restock';
  onClose: () => void;
  onSuccess: (msg: string) => void;
  currentItems: Barang[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImportNew = mode === 'import-new';
  const isMaster = mode === 'master-data';

  // Download Template / Data Terbaru Excel Otomatis
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    if (isImportNew) {
      // Template Barang Baru: TIDAK ADA kolom ID!
      const templateData = [
        { 'Nama Barang': 'Kertas HVS A4 80gsm', Kategori: 'ATK', Satuan: 'Rim', 'Stok Awal': 50 },
        { 'Nama Barang': 'Pulpen Gel Hitam 0.5mm', Kategori: 'ATK', Satuan: 'Lusin', 'Stok Awal': 20 },
        { 'Nama Barang': 'Cairan Pembersih Lantai 1L', Kategori: 'Kebersihan', Satuan: 'Botol', 'Stok Awal': 15 },
        { 'Nama Barang': 'Kopi Sachet 20g (Pack)', Kategori: 'Pantry', Satuan: 'Pack', 'Stok Awal': 10 },
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(wb, ws, 'Barang Baru');
      XLSX.writeFile(wb, 'Template_Import_Barang_Baru.xlsx');
    } else if (isMaster) {
      const templateData = currentItems.length > 0
        ? currentItems.map((item) => ({
            ID: item.id,
            'Nama Barang': item.nama,
            Kategori: item.kategori,
            Satuan: item.satuan,
          }))
        : [
            { ID: 'contoh_id_1', 'Nama Barang': 'Kertas HVS A4 80gsm', Kategori: 'ATK', Satuan: 'Rim' },
            { ID: 'contoh_id_2', 'Nama Barang': 'Cairan Pembersih Lantai', Kategori: 'Kebersihan', Satuan: 'Botol' },
          ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(wb, ws, 'Master Data');
      XLSX.writeFile(wb, 'Template_Update_Master_Data.xlsx');
    } else {
      const templateData = currentItems.length > 0
        ? currentItems.map((item) => ({
            ID: item.id,
            'Nama Barang': item.nama,
            'Penambahan Stok': 10,
          }))
        : [
            { ID: 'contoh_id_1', 'Nama Barang': 'Kertas HVS A4 80gsm', 'Penambahan Stok': 25 },
            { ID: 'contoh_id_2', 'Nama Barang': 'Cairan Pembersih Lantai', 'Penambahan Stok': 12 },
          ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(wb, ws, 'Restock Barang Masuk');
      XLSX.writeFile(wb, 'Template_Restock_Barang_Masuk.xlsx');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErr('Pilih file Excel terlebih dahulu.');
      return;
    }

    setLoading(true);
    setErr('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = isImportNew
        ? '/api/excel/import-barang'
        : isMaster
        ? '/api/excel/master-data'
        : '/api/excel/restock';

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses file Excel.');
      }

      setResult(data);
      onSuccess(data.message || 'File Excel berhasil diproses.');
    } catch (error: any) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${
              isImportNew ? 'bg-indigo-50 text-indigo-600' : isMaster ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {isImportNew ? <FileSpreadsheet size={20} /> : isMaster ? <FileSpreadsheet size={20} /> : <UploadCloud size={20} />}
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                {isImportNew
                  ? 'Import Barang Baru Massal via Excel'
                  : isMaster
                  ? 'Update Master Data via Excel'
                  : 'Restock / Barang Masuk via Excel'}
              </h2>
              <p className="text-xs text-slate-500">
                {isImportNew
                  ? 'Daftarkan banyak barang baru sekaligus tanpa perlu kolom ID'
                  : isMaster
                  ? 'Perbarui Nama, Kategori, Satuan (Stok tidak disentuh)'
                  : 'Tambah stok dengan Atomic Increment'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-6 space-y-4">
          {isImportNew ? (
            /* Kotak Info Format Import Barang Baru */
            <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-900 text-xs leading-relaxed flex items-start gap-2.5 shadow-sm">
              <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-indigo-900">Format Excel Barang Baru: </span>
                <span className="text-indigo-800">
                  File Excel hanya membutuhkan kolom <strong>Nama Barang</strong>, <strong>Kategori</strong>, <strong>Satuan</strong>, dan <strong>Stok Awal</strong>. Kolom ID <strong>tidak diperlukan</strong> karena sistem akan menghasilkan ID dokumen baru secara otomatis. Stok awal akan langsung dicatat ke koleksi <code>riwayat_stok</code>.
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Kotak Peringatan Tegas (Warning Banner Amber) */}
              <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5 shadow-sm">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900">Penting: </span>
                  <span className="text-amber-800">
                    Selalu unduh data terbaru sebelum melakukan pembaruan Excel. Dilarang keras mengubah atau menghapus isi kolom ID. Barang baru tidak dapat ditambahkan melalui Excel; gunakan tombol &apos;+ Tambah Barang&apos; di halaman utama dasbor.
                  </span>
                </div>
              </div>

              {/* Petunjuk Aturan PRD */}
              <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                isMaster ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <p className="font-semibold flex items-center gap-1.5 mb-1">
                  <Info size={14} /> Aturan Bisnis Wajib (PRD):
                </p>
                {isMaster ? (
                  <p>
                    Sistem <strong>hanya memperbarui Nama, Kategori, dan Satuan</strong>. Kolom stok pada Excel diabaikan total agar permintaan yang sedang berjalan tidak terganggu race condition.
                  </p>
                ) : (
                  <p>
                    Sistem menggunakan <strong>Atomic Increment</strong> pada database untuk menambah stok berdasarkan kolom <code>Penambahan Stok</code>. Nilai tidak menimpa, dan perubahan otomatis dicatat ke <code>riwayat_stok</code>.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Unduh Template / Data Terbaru Helper */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                {isImportNew ? 'Perlu format template Excel?' : 'Perlu format data terbaru?'}
              </p>
              <p className="text-[11px] text-slate-500">
                {isImportNew
                  ? 'Unduh template Excel bersih berisi contoh 4 kolom wajib tanpa kolom ID.'
                  : 'Unduh data terbaru yang sudah terisi ID barang katalog Anda.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <Download size={13} />
              {isImportNew ? 'Unduh Template' : 'Unduh Data Terbaru'}
            </button>
          </div>

          {/* Dropzone File */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
              file ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
            <UploadCloud size={32} className={`mx-auto mb-2 ${file ? 'text-blue-600' : 'text-slate-400'}`} />
            {file ? (
              <>
                <p className="font-semibold text-slate-800 text-sm">{file.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB • Klik untuk ganti file</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-slate-700">Pilih atau seret file Excel ke sini</p>
                <p className="text-[11px] text-slate-400 mt-1">Mendukung format .xlsx, .xls, .csv</p>
              </>
            )}
          </div>

          {err && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-xs border border-red-200">
              <AlertCircle size={15} />
              <span>{err}</span>
            </div>
          )}

          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                {result.message}
              </p>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 text-amber-700">
                  <p className="font-semibold">Catatan baris dilewati:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                    {result.errors.slice(0, 3).map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {result ? 'Selesai' : 'Batal'}
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              className={`flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-sm transition-colors disabled:opacity-50 ${
                isImportNew
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : isMaster
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading ? (
                <>
                  <RotateCw size={13} className="animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <span>Upload & Terapkan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 5. Halaman Utama Master Barang & Inventory
// ==========================================
export default function MasterBarangPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // Search & Pagination State
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);

  // Modals State
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data?: Barang } | null>(null);
  const [excelModal, setExcelModal] = useState<'import-new' | 'master-data' | 'restock' | null>(null);

  // Stock Opname Mode
  const [isOpnameMode, setIsOpnameMode] = useState(false);
  const [opnameEdits, setOpnameEdits] = useState<Record<string, string>>({});
  const [isSavingOpname, setIsSavingOpname] = useState(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Fetch Data Barang
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['barang', cursor, search],
    queryFn: () => fetchBarang(cursor, search),
  });

  // Tambah / Edit Mutasi
  const saveMutation = useMutation({
    mutationFn: async (payload: {
      mode: 'add' | 'edit';
      id?: string;
      data: any;
      keepOpen?: boolean;
      resetCb?: () => void;
    }) => {
      if (payload.mode === 'add') {
        const res = await fetch('/api/barang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.data),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error);
        }
        return res.json();
      } else {
        const res = await fetch(`/api/barang/${payload.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.data),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error);
        }
        return res.json();
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['barang'] });
      showToast(variables.mode === 'add' ? `✅ Barang "${variables.data.nama}" berhasil ditambahkan.` : '✅ Barang berhasil diperbarui.');
      if (variables.keepOpen) {
        variables.resetCb?.();
      } else {
        setModal(null);
      }
    },
    onError: (e: any) => showToast(`❌ ${e.message}`),
  });

  // Toggle Aktif / Non-aktif Mutasi
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, aktif }: { id: string; aktif: boolean }) => {
      if (!aktif) {
        const res = await fetch(`/api/barang/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error);
        }
      } else {
        const res = await fetch(`/api/barang/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aktif: true }),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error);
        }
      }
    },
    onSuccess: (_, { aktif }) => {
      queryClient.invalidateQueries({ queryKey: ['barang'] });
      showToast(aktif ? '✅ Barang diaktifkan kembali.' : '✅ Barang dinonaktifkan.');
    },
    onError: (e: any) => showToast(`❌ ${e.message}`),
  });

  // Handler Simpan Stock Opname
  const handleSaveStockOpname = async () => {
    const changedItems = Object.entries(opnameEdits)
      .filter(([_, val]) => val !== '' && !isNaN(parseInt(val)))
      .map(([barangId, stokFisik]) => ({
        barangId,
        stokFisik: parseInt(stokFisik),
      }))
      .filter((item) => Number.isInteger(item.stokFisik) && item.stokFisik >= 0);

    if (changedItems.length === 0) {
      showToast('⚠️ Tidak ada perubahan angka stok fisik yang valid untuk disimpan.');
      return;
    }

    setIsSavingOpname(true);
    try {
      const res = await fetch('/api/stock-opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: changedItems,
          pelakuId: profile?.uid || 'admin',
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Terjadi kesalahan sistem.');

      showToast(`✅ ${json.message}`);
      setOpnameEdits({});
      setIsOpnameMode(false);
      queryClient.invalidateQueries({ queryKey: ['barang'] });
    } catch (err: any) {
      showToast(`❌ ${err.message}`);
    } finally {
      setIsSavingOpname(false);
    }
  };

  function handleNextPage() {
    if (data?.nextCursor) {
      setCursorStack((prev) => [...prev, cursor]);
      setCursor(data.nextCursor);
    }
  }

  function handlePrevPage() {
    const prev = cursorStack[cursorStack.length - 1] ?? null;
    setCursorStack((stack) => stack.slice(0, -1));
    setCursor(prev);
  }

  function handleSearch(val: string) {
    setSearch(val);
    setCursor(null);
    setCursorStack([]);
  }

  const items = data?.items || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-2">
          {toastMsg}
        </div>
      )}

      {/* Modal Tambah / Edit */}
      {modal && (
        <BarangModal
          initial={modal.mode === 'edit' ? modal.data : undefined}
          onClose={() => setModal(null)}
          onSave={(formData, keepOpen, resetCb) =>
            saveMutation.mutate({
              mode: modal.mode,
              id: modal.data?.id,
              data: formData,
              keepOpen,
              resetCb,
            })
          }
          loading={saveMutation.isPending}
        />
      )}

      {/* Modal Upload Excel */}
      {excelModal && (
        <ExcelUploadModal
          mode={excelModal}
          currentItems={items}
          onClose={() => setExcelModal(null)}
          onSuccess={(msg) => {
            showToast(`✅ ${msg}`);
            queryClient.invalidateQueries({ queryKey: ['barang'] });
          }}
        />
      )}

      {/* HEADER UTAMA & ACTION BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Package size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Master Data & Inventori</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Kelola katalog barang, Stock Opname fisik, serta sinkronisasi Excel
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tombol Stock Opname Mode */}
          <button
            onClick={() => {
              setIsOpnameMode(!isOpnameMode);
              setOpnameEdits({});
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
              isOpnameMode
                ? 'bg-amber-500 text-white shadow-amber-500/20'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ClipboardList size={15} />
            <span>{isOpnameMode ? 'Tutup Stock Opname' : 'Mode Stock Opname'}</span>
          </button>

          {/* Tombol Upload Excel Master */}
          <button
            onClick={() => setExcelModal('master-data')}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            <FileSpreadsheet size={15} className="text-blue-600" />
            <span>Update Master (Excel)</span>
          </button>

          {/* Tombol Upload Excel Restock */}
          <button
            onClick={() => setExcelModal('restock')}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            <UploadCloud size={15} className="text-emerald-600" />
            <span>Restock Masuk (Excel)</span>
          </button>

          {/* Tombol Import Barang Baru Massal (Excel) */}
          <button
            onClick={() => setExcelModal('import-new')}
            className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            <UploadCloud size={15} className="text-emerald-600" />
            <span>Import Barang Baru</span>
          </button>

          {/* Tombol Tambah Barang Baru */}
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm shadow-blue-600/20"
          >
            <Plus size={16} />
            <span>+ Tambah Barang</span>
          </button>
        </div>
      </div>

      {/* BANNER STOCK OPNAME (JIKA MODE AKTIF) */}
      {isOpnameMode && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-sm">Mode Stock Opname Sedang Aktif</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Ketikkan angka stok fisik gudang yang sebenarnya pada kolom input di bawah. Perubahan ini akan <strong>menimpa stok database</strong> dan wajib tercatat ke audit <code>riwayat_stok</code>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            <button
              onClick={() => {
                setIsOpnameMode(false);
                setOpnameEdits({});
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-white rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSaveStockOpname}
              disabled={isSavingOpname}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              {isSavingOpname ? (
                <>
                  <RotateCw size={13} className="animate-spin" />
                  <span>Menyimpan Audit...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Simpan Perubahan Fisik</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama atau kategori barang..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
      </div>

      {/* TABEL DATA BARANG */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RotateCw size={28} className="animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-medium text-slate-600">Memuat katalog barang...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-500 gap-2">
            <AlertCircle size={24} />
            <p className="text-sm font-semibold">Gagal memuat data barang.</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold mt-2"
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                      Nama Barang
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                      Kategori
                    </th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                      Satuan
                    </th>
                    <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                      {isOpnameMode ? 'Stok Database vs Fisik Aktual' : 'Stok Gudang'}
                    </th>
                    <th className="text-center px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-right px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400">
                        <Package size={36} className="mx-auto mb-3 opacity-30 text-slate-400" />
                        <p className="text-sm font-medium">Belum ada barang yang terdaftar.</p>
                      </td>
                    </tr>
                  )}
                  {items.map((item) => {
                    const editVal = opnameEdits[item.id] ?? '';
                    const hasEdit = editVal !== '';
                    const parsedFisik = parseInt(editVal);
                    const diff = !isNaN(parsedFisik) ? parsedFisik - item.stok : 0;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          !item.aktif ? 'bg-slate-50/50 opacity-60' : 'hover:bg-slate-50/70'
                        } ${hasEdit ? 'bg-amber-50/50' : ''}`}
                      >
                        {/* Nama Barang */}
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-semibold text-slate-900">{item.nama}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {item.id}</p>
                          </div>
                        </td>

                        {/* Kategori */}
                        <td className="px-5 py-3.5">
                          <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-medium">
                            {item.kategori}
                          </span>
                        </td>

                        {/* Satuan */}
                        <td className="px-5 py-3.5 text-slate-600 font-medium">{item.satuan}</td>

                        {/* Kolom Stok (Mode Standar vs Mode Stock Opname) */}
                        <td className="px-5 py-3.5 text-center">
                          {isOpnameMode ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs text-slate-400 font-mono">DB: {item.stok} →</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder={String(item.stok)}
                                value={editVal}
                                onChange={(e) =>
                                  setOpnameEdits({ ...opnameEdits, [item.id]: e.target.value })
                                }
                                className="w-20 px-2 py-1 text-center font-bold text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                              />
                              {hasEdit && !isNaN(parsedFisik) && (
                                <span
                                  className={`text-xs font-extrabold ${
                                    diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-slate-400'
                                  }`}
                                >
                                  {diff > 0 ? `+${diff}` : diff}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span
                              className={`font-bold text-base ${
                                item.stok === 0
                                  ? 'text-red-500'
                                  : item.stok < 5
                                  ? 'text-amber-500'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {item.stok}
                            </span>
                          )}
                        </td>

                        {/* Status Aktif */}
                        <td className="px-5 py-3.5 text-center">
                          {item.aktif ? (
                            <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1">
                              <Check size={11} /> Aktif
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-500 text-xs px-2.5 py-1 rounded-full font-medium inline-block">
                              Non-aktif
                            </span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setModal({ mode: 'edit', data: item })}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Data"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() =>
                                toggleActiveMutation.mutate({ id: item.id, aktif: !item.aktif })
                              }
                              className={`p-1.5 rounded-lg transition-colors ${
                                item.aktif
                                  ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={item.aktif ? 'Non-aktifkan Barang' : 'Aktifkan Kembali'}
                            >
                              {item.aktif ? <PowerOff size={15} /> : <Power size={15} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/40">
              <p className="text-xs text-slate-500">
                Menampilkan <strong className="text-slate-800">{items.length}</strong> barang di halaman ini
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={cursorStack.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                  <ChevronLeft size={14} />
                  Sebelumnya
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={!data?.nextCursor}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                  Berikutnya
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
