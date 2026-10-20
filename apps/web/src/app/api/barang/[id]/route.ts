import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// PATCH /api/barang/[id] - Edit nama, kategori, satuan (bukan stok)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // ATURAN BISNIS: Hanya boleh update field non-stok
    const allowedFields = ['nama', 'kategori', 'satuan', 'aktif'];
    const updates: Record<string, any> = {};

    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
      }
    }

    // Eksplisit cegah update stok
    if ('stok' in body) {
      return NextResponse.json(
        { error: 'Tidak diizinkan mengubah stok melalui endpoint ini. Gunakan Restock atau Stock Opname.' },
        { status: 403 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang valid untuk diperbarui.' }, { status: 400 });
    }

    const ref = adminDb.collection('barang').doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Barang tidak ditemukan.' }, { status: 404 });
    }

    await ref.update(updates);
    return NextResponse.json({ message: 'Barang berhasil diperbarui.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/barang/[id] - Non-aktifkan (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ref = adminDb.collection('barang').doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Barang tidak ditemukan.' }, { status: 404 });
    }

    // Soft delete: set aktif = false
    await ref.update({ aktif: false });
    return NextResponse.json({ message: 'Barang berhasil dinonaktifkan.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
