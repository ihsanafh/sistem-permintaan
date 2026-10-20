import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// POST /api/stock-opname
// Body: [{ barangId: string, stokFisik: number }]
// Fitur ini satu-satunya yang diizinkan MENIMPA nilai stok, wajib catat audit trail
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, pelakuId } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Data items tidak valid.' }, { status: 400 });
    }

    const results: { id: string; nama: string; stokLama: number; stokBaru: number }[] = [];
    const errors: string[] = [];
    const now = FieldValue.serverTimestamp();

    for (const item of items) {
      const { barangId, stokFisik } = item;

      // Validasi input: harus bilangan bulat non-negatif
      const stokNum = Number(stokFisik);
      if (!Number.isInteger(stokNum) || stokNum < 0) {
        errors.push(`Barang ID "${barangId}": Stok fisik tidak valid (${stokFisik}). Harus bilangan bulat non-negatif.`);
        continue;
      }

      const barangRef = adminDb.collection('barang').doc(barangId);

      await adminDb.runTransaction(async (t) => {
        const barangDoc = await t.get(barangRef);

        if (!barangDoc.exists) {
          errors.push(`Barang ID "${barangId}" tidak ditemukan.`);
          return;
        }

        const dataLama = barangDoc.data()!;
        const stokLama = dataLama.stok || 0;
        const selisih = stokNum - stokLama;

        // ATURAN BISNIS: Stock Opname MENIMPA nilai stok (berbeda dari Restock yang increment)
        t.update(barangRef, { stok: stokNum });

        // WAJIB: Catat audit trail riwayat_stok dalam transaksi yang sama
        const riwayatRef = adminDb.collection('riwayat_stok').doc();
        t.set(riwayatRef, {
          barangId,
          tipe: 'Stock Opname',
          perubahan: selisih,
          stokAkhir: stokNum,
          timestamp: now,
          pelakuId: pelakuId || 'admin',
          keterangan: `Stock Opname: stok lama ${stokLama} → stok baru ${stokNum} (selisih: ${selisih >= 0 ? '+' : ''}${selisih})`,
        });

        results.push({ id: barangId, nama: dataLama.nama, stokLama, stokBaru: stokNum });
      });
    }

    return NextResponse.json({
      message: `Stock Opname selesai. ${results.length} barang diperbarui.`,
      results,
      errors,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
