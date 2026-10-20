'use client';

import { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

type UploadMode = 'master-data' | 'restock';

interface UploadResult {
  message: string;
  errors?: string[];
  updated?: number;
  restocked?: { id: string; nama: string; penambahan: number }[];
}

function FileDropZone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  function handleFile(f: File) {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv');
      return;
    }
    setFileName(f.name);
    onFile(f);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
        dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <UploadCloud size={36} className={`mx-auto mb-3 ${dragging ? 'text-blue-500' : 'text-slate-300'}`} />
      {fileName ? (
        <>
          <p className="font-medium text-slate-700 text-sm">{fileName}</p>
          <p className="text-xs text-slate-400 mt-1">Klik untuk ganti file</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-600">Seret file ke sini, atau klik untuk memilih</p>
          <p className="text-xs text-slate-400 mt-1">Mendukung .xlsx, .xls, .csv</p>
        </>
      )}
    </div>
  );
}

function downloadTemplate(mode: UploadMode) {
  const wb = XLSX.utils.book_new();
  let data: any[];
  let sheetName: string;

  if (mode === 'master-data') {
    data = [
      { ID: 'contoh-id-123', 'Nama Barang': 'Kertas A4 80gsm', Kategori: 'ATK', Satuan: 'Rim' },
    ];
    sheetName = 'Master Data';
  } else {
    data = [
      { ID: 'contoh-id-123', 'Nama Barang': 'Kertas A4 80gsm', 'Penambahan Stok': 10 },
    ];
    sheetName = 'Restock';
  }

  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `template_${mode}.xlsx`);
}

export default function RestockPage() {
  const [mode, setMode] = useState<UploadMode>('restock');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [apiError, setApiError] = useState('');

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setApiError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = mode === 'restock' ? '/api/excel/restock' : '/api/excel/master-data';
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        setApiError(json.error || 'Terjadi kesalahan.');
      } else {
        setResult(json);
      }
    } catch (e: any) {
      setApiError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Upload Excel</h1>
        <p className="text-slate-500 text-sm mt-0.5">Restock barang atau perbarui master data via file Excel</p>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {([
          { key: 'restock', label: 'Restock (Tambah Stok)', desc: 'Gunakan kolom "Penambahan Stok". Stok ditambah secara atomic.', color: 'green' },
          { key: 'master-data', label: 'Update Master Data', desc: 'Hanya ubah Nama, Kategori, Satuan. Stok tidak akan berubah.', color: 'blue' },
        ] as const).map(({ key, label, desc, color }) => (
          <button
            key={key}
            onClick={() => { setMode(key); setResult(null); setFile(null); setApiError(''); }}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              mode === key
                ? color === 'green'
                  ? 'border-green-500 bg-green-50'
                  : 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <p className={`font-semibold text-sm ${mode === key ? (color === 'green' ? 'text-green-700' : 'text-blue-700') : 'text-slate-700'}`}>{label}</p>
            <p className="text-xs text-slate-500 mt-1">{desc}</p>
          </button>
        ))}
      </div>

      {/* Info Box */}
      <div className={`flex items-start gap-3 p-4 rounded-xl mb-5 text-sm ${
        mode === 'restock' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
      }`}>
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
        <div>
          {mode === 'restock' ? (
            <p>Kolom wajib: <strong>ID</strong> dan <strong>Penambahan Stok</strong>. Nilai harus bilangan bulat positif. File yang sama tidak bisa diupload dua kali (idempotensi).</p>
          ) : (
            <p>Kolom wajib: <strong>ID</strong>. Kolom opsional: <strong>Nama Barang</strong>, <strong>Kategori</strong>, <strong>Satuan</strong>. Kolom <strong>Stok akan diabaikan</strong> meskipun ada di file.</p>
          )}
        </div>
      </div>

      {/* Download Template */}
      <button
        onClick={() => downloadTemplate(mode)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600 mb-4 transition-colors"
      >
        <Download size={13} />
        Download template Excel untuk mode ini
      </button>

      {/* Drop Zone */}
      <FileDropZone onFile={setFile} />

      {/* Error */}
      {apiError && (
        <div className="mt-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <XCircle size={16} className="flex-shrink-0 mt-0.5" />
          {apiError}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-700 font-medium text-sm mb-2">
            <CheckCircle2 size={16} />
            {result.message}
          </div>
          {result.errors && result.errors.length > 0 && (
            <div>
              <button
                onClick={() => setShowErrors(!showErrors)}
                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 mt-2"
              >
                {showErrors ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {result.errors.length} baris dilewati / error
              </button>
              {showErrors && (
                <ul className="mt-2 space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">• {e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="mt-5 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <FileSpreadsheet size={16} />
        {loading ? 'Memproses...' : mode === 'restock' ? 'Upload & Proses Restock' : 'Upload & Update Master Data'}
      </button>
    </div>
  );
}
