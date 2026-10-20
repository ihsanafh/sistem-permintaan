import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';

// POST /api/excel/master-data
// Upload Excel untuk update Master Data (nama, kategori, satuan SAJA - DILARANG menyentuh stok)
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
      return NextResponse.json({ error: 'File Excel kosong.' }, { status: 400 });
    }

    const errors: string[] = [];
    const updated: string[] = [];
    const batch = adminDb.batch();

    for (const row of rows) {
      const id = String(row['ID'] || row['id'] || '').trim();
      const nama = String(row['Nama Barang'] || row['nama'] || '').trim();
      const kategori = String(row['Kategori'] || row['kategori'] || '').trim();
      const satuan = String(row['Satuan'] || row['satuan'] || '').trim();

      if (!id) {
        errors.push(`Baris dilewati: kolom ID kosong (nama: ${nama || 'unknown'})`);
        continue;
      }

      const ref = adminDb.collection('barang').doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        errors.push(`ID "${id}" tidak ditemukan di database. Baris dilewati.`);
        continue;
      }

      // ATURAN BISNIS WAJIB: Hanya update field non-stok
      const updateData: Record<string, any> = {};
      if (nama) updateData.nama = nama;
      if (kategori) updateData.kategori = kategori;
      if (satuan) updateData.satuan = satuan;
      // Stok TIDAK pernah disentuh di sini

      if (Object.keys(updateData).length > 0) {
        batch.update(ref, updateData);
        updated.push(id);
      }
    }

    await batch.commit();

    return NextResponse.json({
      message: `Upload Master Data selesai. ${updated.length} barang diperbarui.`,
      updated: updated.length,
      errors,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
