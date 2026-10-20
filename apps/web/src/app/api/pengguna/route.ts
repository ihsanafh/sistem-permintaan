import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// GET /api/pengguna - Ambil semua pengguna
export async function GET() {
  try {
    const snapshot = await adminDb.collection('users').orderBy('displayName').get();
    const users = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
