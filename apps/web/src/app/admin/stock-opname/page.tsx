'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ClipboardList, AlertCircle, CheckCircle2, Save, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Barang {
  id: string;
  nama: string;
  kategori: string;
  satuan: string;
  stok: number;
  aktif: boolean;
}

interface StokEdit {
  [barangId: string]: string;
}

export default function StockOpnamePage() {
  const { profile } = useAuth();
  const [stokEdits, setStokEdits] = useState<StokEdit>({});
  const [result, setResult] = useState<{ message: string; results: any[]; errors: string[] } | null>(null);
  const [apiError, setApiError] = useState('');
  const [page, setPage] = useState<{ cursor: string | null; stack: (string | null)[] }>({ cursor: null, stack: [] });

  const { data, isLoading } = useQuery({
    queryKey: ['barang-opname', page.cursor],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '20' });
      if (page.cursor) params.set('after', page.cursor);
      const res = await fetch(`/api/barang?${params}`);
      return res.json() as Promise<{ items: Barang[]; nextCursor: string | null }>;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      // Hanya kirim barang yang benar-benar diubah
      const changedItems = Object.entries(stokEdits)
        .filter(([id, val]) => val !== '')
        .map(([barangId, stokFisik]) => ({ barangId, stokFisik: parseInt(stokFisik) }))
        .filter((item) => Number.isInteger(item.stokFisik) && item.stokFisik >= 0);

      if (changedItems.length === 0) {
        throw new Error('Tidak ada perubahan stok yang valid untuk disimpan.');
      }

      const res = await fetch('/api/stock-opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: changedItems, pelakuId: profile?.uid }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Terjadi kesalahan.');
      return json;
    },
    onSuccess: (data) => {
      setResult(data);
      setStokEdits({});
      setApiError('');
    },
    onError: (e: any) => {
      setApiError(e.message);
    },
  });

  const changedCount = Object.values(stokEdits).filter((v) => v !== '').length;

  function validateInput(val: string): boolean {
    if (val === '') return true; // kosong = tidak diubah
    const num = parseInt(val);
    return !isNaN(num) && Number.isInteger(num) && num >= 0;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Opname</h1>
          <p className="text-slate-500 text-sm mt-0.5">Penyesuaian stok fisik gudang — hanya fitur ini yang boleh menimpa nilai stok</p>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || changedCount === 0}
          className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Save size={15} />
          {mutation.isPending ? 'Menyimpan...' : `Simpan ${changedCount > 0 ? `(${changedCount} item)` : ''}`}
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl p-4 mb-5 text-sm text-violet-800">
        <Info size={16} className="flex-shrink-0 mt-0.5" />
        <p>
          Isi kolom <strong>"Stok Fisik Aktual"</strong> hanya untuk barang yang ingin disesuaikan. Biarkan kosong jika stok sudah benar.
          Setiap perubahan akan otomatis tercatat di <strong>riwayat stok</strong> sebagai audit trail.
        </p>
      </div>

      {/* Error */}
      {apiError && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
          <AlertCircle size={15} /> {apiError}
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 text-green-700 font-medium text-sm mb-2">
            <CheckCircle2 size={15} /> {result.message}
          </div>
          {result.results.length > 0 && (
            <ul className="space-y-1 mt-2">
              {result.results.map((r) => (
                <li key={r.id} className="text-xs text-green-700 bg-green-100 px-3 py-1.5 rounded-lg">
                  <strong>{r.nama}</strong>: {r.stokLama} → {r.stokBaru} (selisih: {r.stokBaru - r.stokLama >= 0 ? '+' : ''}{r.stokBaru - r.stokLama})
                </li>
              ))}
            </ul>
          )}
          {result.errors.length > 0 && (
            <ul className="space-y-1 mt-2">
              {result.errors.map((e, i) => (
                <li key={i} className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">⚠️ {e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mr-3" />
            Memuat data barang...
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Nama Barang</th>
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Kategori</th>
                  <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Satuan</th>
                  <th className="text-center px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Stok Database</th>
                  <th className="text-center px-5 py-3.5 font-medium text-violet-600 text-xs uppercase tracking-wide">Stok Fisik Aktual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items?.map((item) => {
                  const editVal = stokEdits[item.id] ?? '';
                  const isChanged = editVal !== '';
                  const isValid = validateInput(editVal);
                  const numericVal = editVal !== '' ? parseInt(editVal) : null;
                  const selisih = numericVal !== null ? numericVal - item.stok : null;

                  return (
                    <tr key={item.id} className={`transition-colors ${isChanged ? 'bg-violet-50/40' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-5 py-3.5 font-medium text-slate-800">{item.nama}</td>
                      <td className="px-5 py-3.5">
                        <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{item.kategori}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{item.satuan}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`font-bold ${item.stok === 0 ? 'text-red-500' : item.stok < 5 ? 'text-amber-500' : 'text-slate-700'}`}>
                          {item.stok}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            placeholder="—"
                            value={editVal}
                            onChange={(e) => setStokEdits((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className={`w-24 text-center border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 transition-all ${
                              !isValid && editVal !== ''
                                ? 'border-red-400 ring-red-200 bg-red-50'
                                : isChanged
                                ? 'border-violet-400 ring-violet-100 bg-violet-50'
                                : 'border-slate-200 focus:ring-violet-300'
                            }`}
                          />
                          {selisih !== null && isValid && (
                            <span className={`text-xs font-medium tabular-nums ${selisih > 0 ? 'text-green-600' : selisih < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                              {selisih > 0 ? '+' : ''}{selisih}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-500">Menampilkan {data?.items?.length ?? 0} barang</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => ({ cursor: p.stack[p.stack.length - 1] ?? null, stack: p.stack.slice(0, -1) }))}
                  disabled={page.stack.length === 0}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all"
                >
                  ← Sebelumnya
                </button>
                <button
                  onClick={() => { if (data?.nextCursor) setPage((p) => ({ cursor: data.nextCursor, stack: [...p.stack, p.cursor] })); }}
                  disabled={!data?.nextCursor}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-all"
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-200" />
          Baris yang sudah diubah
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-200" />
          Nilai tidak valid (harus ≥ 0)
        </div>
      </div>
    </div>
  );
}
