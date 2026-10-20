import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';
import crypto from 'crypto';

// POST /api/excel/restock
// Upload Restock Excel - WAJIB atomic increment, idempotensi via batch ID
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    // --- IDEMPOTENSI: Buat hash file untuk deteksi upload duplikat ---
    const hashBuffer = Buffer.from(buffer);
    const fileHash = crypto.createHash('sha256').update(hashBuffer).digest('hex');

    const batchRef = adminDb.collection('batch_uploads').doc(fileHash);
    const batchDoc = await batchRef.get();

    if (batchDoc.exists) {
      return NextResponse.json(
        {
          error: 'File ini sudah pernah diupload sebelumnya dan akan diabaikan untuk mencegah penambahan stok ganda.',
          batchId: fileHash,
          uploadedAt: batchDoc.data()?.uploadedAt,
        },
        { status: 409 }
      );
    }

    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong.' }, { status: 400 });
    }

    const errors: string[] = [];
    const restocked: { id: string; nama: string; penambahan: number }[] = [];
    const now = FieldValue.serverTimestamp();

    // Proses setiap baris secara individual (atomic increment per item)
    for (const row of rows) {
      const id = String(row['ID'] || row['id'] || '').trim();
      const penambahan = row['Penambahan Stok'] ?? row['penambahan_stok'];

      if (!id) {
        errors.push(`Baris dilewati: kolom ID kosong.`);
        continue;
      }

      // Validasi angka penambahan
      const penambahanNum = Number(penambahan);
      if (isNaN(penambahanNum) || !Number.isInteger(penambahanNum) || penambahanNum <= 0) {
        errors.push(`ID "${id}": Penambahan stok tidak valid (${penambahan}). Harus bilangan bulat positif. Baris dilewati.`);
        continue;
      }

      const barangRef = adminDb.collection('barang').doc(id);
      const barangDoc = await barangRef.get();

      if (!barangDoc.exists) {
        errors.push(`ID "${id}" tidak ditemukan di database. Baris dilewati.`);
        continue;
      }

      const barangData = barangDoc.data()!;
      const stokBaru = (barangData.stok || 0) + penambahanNum;

      // ATURAN BISNIS: Gunakan Firestore transaction untuk atomic increment + riwayat_stok
      await adminDb.runTransaction(async (t) => {
        // Atomic increment - tidak menimpa, hanya menambah
        t.update(barangRef, {
          stok: FieldValue.increment(penambahanNum),
        });

        // WAJIB: catat riwayat stok dalam transaksi yang sama
        const riwayatRef = adminDb.collection('riwayat_stok').doc();
        t.set(riwayatRef, {
          barangId: id,
          tipe: 'Restock Excel',
          perubahan: penambahanNum,
          stokAkhir: stokBaru,
          timestamp: now,
          pelakuId: 'admin', // Idealnya dari session, untuk sekarang static
          keterangan: `Restock via Excel. Batch ID: ${fileHash.substring(0, 8)}`,
        });
      });

      restocked.push({ id, nama: barangData.nama, penambahan: penambahanNum });
    }

    // Simpan record batch upload untuk idempotensi ke depan
    await batchRef.set({
      fileHash,
      uploadedAt: now,
      restocked: restocked.length,
      errors: errors.length,
    });

    return NextResponse.json({
      message: `Restock selesai. ${restocked.length} barang berhasil ditambah stoknya.`,
      restocked,
      errors,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
