import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// 3 Hari dalam milidetik (72 Jam)
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * GET & POST /api/cron/auto-confirm
 * Endpoint khusus yang mencari dokumen permintaan berstatus "Disiapkan"
 * yang belum dikonfirmasi terima selama lebih dari 3 hari sejak disiapkan/diantar.
 * Mengubah statusnya menjadi "Diterima (Otomatis)".
 *
 * Aman untuk dipicu oleh Vercel Cron (Authorization: Bearer <CRON_SECRET>)
 */
async function handleAutoConfirm(req: NextRequest) {
  try {
    // 1. Verifikasi Keamanan Vercel Cron
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized: CRON_SECRET tidak valid.' }, { status: 401 });
    }

    const now = Date.now();
    const cutoffDate = new Date(now - THREE_DAYS_MS);
    const serverTime = FieldValue.serverTimestamp();

    // 2. Ambil seluruh permintaan yang berstatus "Disiapkan"
    const snapshot = await adminDb
      .collection('permintaan')
      .where('status', '==', 'Disiapkan')
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada dokumen berstatus "Disiapkan".',
        updatedCount: 0,
        scannedCount: 0,
        cutoffDate: cutoffDate.toISOString(),
      });
    }

    const updatedIds: string[] = [];
    const autoConfirmedList: { id: string; namaPegawai: string; hariTertahan: number }[] = [];

    let batch = adminDb.batch();
    let opCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      // Cari timestamp acuan saat barang disiapkan atau diantar
      // Urutan prioritas: approvedAt -> waktuDisiapkan -> updatedAt -> tanggalPengajuan -> createdAt
      let refTime: number | null = null;

      const rawTime =
        data.approvedAt ||
        data.waktuDisiapkan ||
        data.updatedAt ||
        data.tanggalPengajuan ||
        data.createdAt;

      if (rawTime) {
        if (typeof rawTime.toMillis === 'function') {
          refTime = rawTime.toMillis();
        } else if (typeof rawTime.toDate === 'function') {
          refTime = rawTime.toDate().getTime();
        } else if (typeof rawTime.seconds === 'number') {
          refTime = rawTime.seconds * 1000;
        } else if (typeof rawTime === 'string' || typeof rawTime === 'number') {
          refTime = new Date(rawTime).getTime();
        }
      }

      // Jika tidak ada timestamp sama sekali, gunakan fallback waktu sekarang (jangan auto-confirm sembarangan)
      if (!refTime || isNaN(refTime)) {
        continue;
      }

      // Hitung selisih waktu
      const diffMs = now - refTime;

      // Jika sudah lebih dari 3 hari (diffMs >= THREE_DAYS_MS)
      if (diffMs >= THREE_DAYS_MS) {
        const daysPassed = (diffMs / (24 * 60 * 60 * 1000)).toFixed(1);

        // Update dokumen permintaan
        batch.update(docSnap.ref, {
          status: 'Diterima (Otomatis)',
          waktuDiterima: serverTime,
          waktuSelesai: serverTime,
          autoConfirmedAt: serverTime,
          catatanOtomatis: `Dikonfirmasi otomatis oleh cron sistem setelah ${daysPassed} hari sejak disiapkan tanpa konfirmasi dari pegawai.`,
        });
        opCount++;

        // Catat ke delivery_logs agar riwayat terlacak
        const logRef = adminDb.collection('delivery_logs').doc();
        batch.set(logRef, {
          permintaanId: docSnap.id,
          petugasId: 'system_cron',
          namaPetugas: 'Sistem Otomatis (Cron)',
          pegawaiId: data.pegawaiId || data.userId || '',
          namaPegawai: data.namaPegawai || 'Pegawai',
          divisi: data.divisi || 'Umum',
          hasil: 'Diterima (Otomatis)',
          catatan: `Otomatis dikonfirmasi selesai karena telah melampaui batas toleransi 3 hari (${daysPassed} hari).`,
          timestamp: serverTime,
        });
        opCount++;

        updatedIds.push(docSnap.id);
        autoConfirmedList.push({
          id: docSnap.id,
          namaPegawai: data.namaPegawai || 'Pegawai',
          hariTertahan: parseFloat(daysPassed),
        });

        // Batasi ukuran batch (maks 400 ops per commit)
        if (opCount >= 400) {
          await batch.commit();
          batch = adminDb.batch();
          opCount = 0;
        }
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: `Proses Auto-Confirm selesai. Berhasil memperbarui ${updatedIds.length} permintaan menjadi 'Diterima (Otomatis)'.`,
      updatedCount: updatedIds.length,
      scannedCount: snapshot.docs.length,
      cutoffDate: cutoffDate.toISOString(),
      updatedItems: autoConfirmedList,
    });
  } catch (err: any) {
    console.error('Error in cron auto-confirm:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleAutoConfirm(req);
}

export async function POST(req: NextRequest) {
  return handleAutoConfirm(req);
}
