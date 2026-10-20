import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const ALLOWED_ROLES = ['pegawai', 'admin', 'petugas'];

// PATCH /api/pengguna/[uid] - Ubah role pengguna
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const { uid } = await params;
    const body = await req.json();
    const { role } = body;

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: `Role tidak valid. Pilihan: ${ALLOWED_ROLES.join(', ')}` }, { status: 400 });
    }

    const ref = adminDb.collection('users').doc(uid);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
    }

    await ref.update({ role });
    return NextResponse.json({ message: `Role pengguna berhasil diubah menjadi "${role}".` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
