import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// GET /api/barang?page=1&limit=20&search=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const afterId = searchParams.get('after') || null; // cursor pagination

    let query = adminDb.collection('barang').orderBy('nama').limit(limit);

    if (afterId) {
      const afterDoc = await adminDb.collection('barang').doc(afterId).get();
      if (afterDoc.exists) {
        query = query.startAfter(afterDoc);
      }
    }

    const snapshot = await query.get();
    let items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Client-side filter jika ada search (Firestore free tier tidak support full text search)
    if (search) {
      items = items.filter((item: any) =>
        item.nama?.toLowerCase().includes(search) ||
        item.kategori?.toLowerCase().includes(search)
      );
    }

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      items,
      nextCursor: snapshot.docs.length === limit ? lastDoc?.id : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/barang - Tambah barang baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nama, kategori, satuan, stokAwal } = body;

    if (!nama || !kategori || !satuan) {
      return NextResponse.json({ error: 'Nama, kategori, dan satuan wajib diisi.' }, { status: 400 });
    }

    const stok = parseInt(stokAwal ?? '0');
    if (!Number.isInteger(stok) || stok < 0) {
      return NextResponse.json({ error: 'Stok awal harus bilangan bulat non-negatif.' }, { status: 400 });
    }

    const now = FieldValue.serverTimestamp();
    const batch = adminDb.batch();

    // Buat dokumen barang baru
    const barangRef = adminDb.collection('barang').doc();
    batch.set(barangRef, {
      nama: nama.trim(),
      kategori: kategori.trim(),
      satuan: satuan.trim(),
      stok,
      aktif: true,
      createdAt: now,
    });

    // Catat riwayat stok awal jika stok > 0
    if (stok > 0) {
      const riwayatRef = adminDb.collection('riwayat_stok').doc();
      batch.set(riwayatRef, {
        barangId: barangRef.id,
        tipe: 'Stock Opname',
        perubahan: stok,
        stokAkhir: stok,
        timestamp: now,
        pelakuId: 'system',
        keterangan: 'Stok awal saat barang dibuat',
      });
    }

    await batch.commit();
    return NextResponse.json({ id: barangRef.id, message: 'Barang berhasil ditambahkan.' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
