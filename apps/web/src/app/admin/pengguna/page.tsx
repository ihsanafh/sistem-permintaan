'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Shield, Truck, User, AlertCircle } from 'lucide-react';
import { useState } from 'react';

const ROLES = ['pegawai', 'admin', 'petugas'] as const;
type Role = typeof ROLES[number];

const roleConfig = {
  admin: { label: 'Admin', color: 'bg-purple-100 text-purple-700', icon: Shield },
  petugas: { label: 'Petugas Antar', color: 'bg-blue-100 text-blue-700', icon: Truck },
  pegawai: { label: 'Pegawai', color: 'bg-slate-100 text-slate-600', icon: User },
};

export default function PenggunaPage() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/pengguna');
      if (!res.ok) throw new Error('Gagal memuat data pengguna');
      return res.json() as Promise<{ users: any[] }>;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ uid, role }: { uid: string; role: Role }) => {
      const res = await fetch(`/api/pengguna/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: (_, { role }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast(`✅ Role pengguna berhasil diubah menjadi "${role}".`);
    },
    onError: (e: any) => showToast(`❌ ${e.message}`),
  });

  return (
    <div className="p-8">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-800 text-white text-sm px-4 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Kelola Pengguna</h1>
        <p className="text-slate-500 text-sm mt-0.5">Atur role setiap pengguna yang telah login</p>
      </div>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
        <p>Pengguna baru yang login via Google akan otomatis mendapat role <strong>Pegawai</strong>. Ubah di sini untuk memberikan akses <strong>Admin</strong> atau <strong>Petugas Antar</strong>.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-3" />
            Memuat pengguna...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Nama</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Email</th>
                <th className="text-left px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Divisi</th>
                <th className="text-center px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Role Saat Ini</th>
                <th className="text-center px-5 py-3.5 font-medium text-slate-500 text-xs uppercase tracking-wide">Ubah Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.users?.map((user: any) => {
                const rc = roleConfig[user.role as Role] ?? roleConfig.pegawai;
                return (
                  <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800">{user.displayName || '-'}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{user.email}</td>
                    <td className="px-5 py-3.5 text-slate-500">{user.divisi || '-'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${rc.color}`}>
                        <rc.icon size={11} />
                        {rc.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <select
                        value={user.role}
                        onChange={(e) => updateRoleMutation.mutate({ uid: user.uid, role: e.target.value as Role })}
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{roleConfig[r].label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
