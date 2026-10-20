'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Edit2, PowerOff, Power, X, Check,
  ChevronRight, ChevronLeft, AlertCircle, Package
} from 'lucide-react';

interface Barang {
  id: string;
  nama: string;
  kategori: string;
  satuan: string;
  stok: number;
  aktif: boolean;
}

// ---- API Helpers ----
async function fetchBarang(cursor: string | null, search: string) {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('after', cursor);
  if (search) params.set('search', search);
  const res = await fetch(`/api/barang?${params}`);
  if (!res.ok) throw new Error('Gagal memuat data barang');
  return res.json() as Promise<{ items: Barang[]; nextCursor: string | null }>;
}

// ---- Modal Tambah / Edit Barang ----
function BarangModal({
  initial,
  onClose,
  onSave,
  loading,
}: {
  initial?: Partial<Barang>;
  onClose: () => void;
  onSave: (data: Partial<Barang>) => void;
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nama.trim() || !form.kategori.trim() || !form.satuan.trim()) {
      setErr('Nama, kategori, dan satuan wajib diisi.');
      return;
    }
    if (!isEdit) {
      const stok = parseInt(form.stokAwal || '0');
      if (isNaN(stok) || stok < 0 || !Number.isInteger(stok)) {
        setErr('Stok awal harus bilangan bulat non-negatif.');
        return;
      }
    }
    setErr('');
    onSave({ ...form });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-slate-800">{isEdit ? 'Edit Barang' : 'Tambah Barang Baru'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={15} /> {err}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nama Barang</label>
            <input
              type="text"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="cth: Kertas A4 80gsm"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Kategori</label>
              <input
                type="text"
                value={form.kategori}
                onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                placeholder="cth: ATK"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Satuan</label>
              <input
                type="text"
                value={form.satuan}
                onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                placeholder="cth: Rim, Pcs"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Stok Awal</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.stokAwal}
                onChange={(e) => setForm({ ...form, stokAwal: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Untuk menambah stok nanti, gunakan fitur Restock Excel.</p>
            </div>
          )}
          {isEdit && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              ⚠️ Mode edit hanya mengubah nama, kategori, dan satuan. Stok tidak akan berubah.
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Halaman Utama ----
export default function MasterBarangPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data?: Barang } | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['barang', cursor, search],
    queryFn: () => fetchBarang(cursor, search),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { mode: 'add' | 'edit'; id?: string; data: any }) => {
      if (payload.mode === 'add') {
        const res = await fetch('/api/barang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.data),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        return res.json();
      } else {
        const res = await fetch(`/api/barang/${payload.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.data),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        return res.json();
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['barang'] });
      setModal(null);
      showToast(variables.mode === 'add' ? '✅ Barang berhasil ditambahkan.' : '✅ Barang berhasil diperbarui.');
    },
    onError: (e: any) => showToast(`❌ ${e.message}`),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, aktif }: { id: string; aktif: boolean }) => {
      if (!aktif) {
        const res = await fetch(`/api/barang/${id}`, { method: 'DELETE' });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      } else {
        const res = await fetch(`/api/barang/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aktif: true }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      }
    },
    onSuccess: (_, { aktif }) => {
      queryClient.invalidateQueries({ queryKey: ['barang'] });
      showToast(aktif ? '✅ Barang diaktifkan kembali.' : '✅ Barang dinonaktifkan.');
    },
    onError: (e: any) => showToast(`❌ ${e.message}`),
  });

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

  return (
    <div className="p-8">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-slate-800 text-white text-sm px-4 py-3 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2">
          {toastMsg}
        </div>
      )}

      {modal && (
        <BarangModal
          initial={modal.mode === 'edit' ? modal.data : undefined}
          onClose={() => setModal(null)}
          onSave={(formData) =>
            saveMutation.mutate({
              mode: modal.mode,
              id: modal.data?.id,
              data: formData,
            })
          }
          loading={saveMutation.isPending}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master Barang</h1>
          <p className="text-slate-500 text-sm mt-0.5">Kelola katalog dan informasi barang</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Tambah Barang
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama atau kategori barang..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full max-w-sm border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
            Memuat data...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-20 text-red-500 gap-2">
            <AlertCircle size={18} /> Gagal memuat data. Coba lagi.
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Nama Barang</th>
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Kategori</th>
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Satuan</th>
                  <th className="text-center px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Stok</th>
                  <th className="text-center px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <Package size={36} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Belum ada barang yang terdaftar.</p>
                    </td>
                  </tr>
                )}
                {data?.items?.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50/70 transition-colors ${!item.aktif ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{item.nama}</td>
                    <td className="px-5 py-3.5">
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">{item.kategori}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{item.satuan}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`font-bold text-base ${item.stok === 0 ? 'text-red-500' : item.stok < 5 ? 'text-amber-500' : 'text-green-600'}`}>
                        {item.stok}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {item.aktif ? (
                        <span className="bg-green-50 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 w-fit mx-auto">
                          <Check size={11} /> Aktif
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 text-xs px-2.5 py-1 rounded-full font-medium w-fit mx-auto block">Non-aktif</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setModal({ mode: 'edit', data: item })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => toggleActiveMutation.mutate({ id: item.id, aktif: !item.aktif })}
                          className={`p-1.5 rounded-lg transition-all ${
                            item.aktif
                              ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                              : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={item.aktif ? 'Nonaktifkan' : 'Aktifkan kembali'}
                        >
                          {item.aktif ? <PowerOff size={15} /> : <Power size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-500">Menampilkan {data?.items?.length ?? 0} barang</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={cursorStack.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={14} /> Sebelumnya
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={!data?.nextCursor}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Berikutnya <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
