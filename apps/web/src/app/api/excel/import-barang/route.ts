import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

// POST /api/excel/import-barang
// Import barang baru massal via Excel tanpa kolom ID
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong atau tidak memiliki data baris.' }, { status: 400 });
    }

    const errors: string[] = [];
    let insertedCount = 0;
    const now = FieldValue.serverTimestamp();

    let batch = adminDb.batch();
    let opCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Asumsi baris 1 adalah header Excel

      const nama = String(row['Nama Barang'] || row['nama'] || row['Nama'] || row['nama_barang'] || '').trim();
      const kategori = String(row['Kategori'] || row['kategori'] || '').trim();
      const satuan = String(row['Satuan'] || row['satuan'] || '').trim();

      const rawStok = row['Stok Awal'] ?? row['stok_awal'] ?? row['stokAwal'] ?? row['Stok'] ?? row['stok'] ?? 0;
      const stok = parseInt(String(rawStok), 10);

      // Validasi kelengkapan data
      if (!nama || !kategori || !satuan) {
        errors.push(`Baris ${rowNum}: Nama Barang, Kategori, dan Satuan wajib diisi (Nama: "${nama || '-'}").`);
        continue;
      }

      if (isNaN(stok) || stok < 0 || !Number.isInteger(stok)) {
        errors.push(`Baris ${rowNum} (${nama}): Stok Awal harus berupa bilangan bulat non-negatif.`);
        continue;
      }

      // Generate dokumen barang baru
      const barangRef = adminDb.collection('barang').doc();
      batch.set(barangRef, {
        nama,
        kategori,
        satuan,
        stok,
        aktif: true,
        createdAt: now,
      });
      opCount++;

      // Catat riwayat stok awal jika stok > 0
      if (stok > 0) {
        const riwayatRef = adminDb.collection('riwayat_stok').doc();
        batch.set(riwayatRef, {
          barangId: barangRef.id,
          tipe: 'Stok Awal',
          perubahan: stok,
          stokAkhir: stok,
          timestamp: now,
          pelakuId: 'admin_excel',
          keterangan: 'Import barang baru via Excel',
        });
        opCount++;
      }

      insertedCount++;

      // Batasi operasi batch di bawah batas 500 Firestore (setiap batch max 400 ops)
      if (opCount >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        opCount = 0;
      }
    }

    // Commit sisa batch
    if (opCount > 0) {
      await batch.commit();
    }

    if (insertedCount === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Tidak ada barang yang berhasil di-import.',
          errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: `Import selesai. Berhasil mendaftarkan ${insertedCount} barang baru ke katalog.`,
      inserted: insertedCount,
      errors,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
