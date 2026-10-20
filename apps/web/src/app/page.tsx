'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Package } from 'lucide-react';

export default function Home() {
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'admin') {
        router.replace('/admin');
      }
      // Mobile users (pegawai/petugas) would use the mobile app
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
          {/* Logo */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/40">
            <Package size={28} className="text-white" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Sistem Permintaan Barang</h1>
          <p className="text-slate-400 text-sm mb-8">
            Platform internal manajemen permintaan barang habis pakai
          </p>

          {!user ? (
            <>
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-3 bg-white text-slate-800 font-semibold py-3 px-5 rounded-xl hover:bg-slate-100 transition-all duration-150 shadow-sm hover:shadow-md"
              >
                {/* Google logo SVG */}
                <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Masuk dengan Google
              </button>
              <p className="text-xs text-slate-500 mt-4">
                Gunakan akun Google kantor Anda untuk masuk.
              </p>
            </>
          ) : (
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Mengalihkan...</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Admin Gudang → Web (halaman ini) &nbsp;|&nbsp; Pegawai & Petugas → Aplikasi Mobile
        </p>
      </div>
    </div>
  );
}
