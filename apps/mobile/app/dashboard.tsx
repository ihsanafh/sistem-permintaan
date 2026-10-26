import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  where,
  onSnapshot,
  addDoc, 
  updateDoc,
  doc,
  serverTimestamp 
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { auth, db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { useCart } from '../lib/useCart';

// ==========================================
// 1. Tipe Data (Sesuai Skema Firestore)
// ==========================================
export interface Barang {
  id: string;
  nama: string;
  kategori: string;
  satuan: string;
  stok: number;
  aktif?: boolean;
}

export interface PermintaanItem {
  barangId: string;
  namaBarang: string;
  kategori: string;
  satuan: string;
  jumlah: number;
}

export interface Permintaan {
  id: string;
  userId?: string;
  pegawaiId: string;
  namaPegawai: string;
  emailPegawai?: string;
  divisi?: string;
  status: 'Menunggu Persetujuan' | 'Disiapkan' | 'Diterima' | 'Diterima (Otomatis)' | 'Ditolak';
  tanggalPengajuan?: any;
  createdAt?: any;
  catatan?: string;
  items: PermintaanItem[];
  totalJenisBarang?: number;
  totalKuantitas?: number;
  waktuDiterima?: any;
}

export interface DeliveryLog {
  id: string;
  permintaanId: string;
  petugasId: string;
  namaPetugas: string;
  pegawaiId?: string;
  namaPegawai: string;
  divisi?: string;
  hasil: string;
  catatan?: string;
  timestamp?: any;
}

// ==========================================
// 2. Fetcher Katalog Barang (Modular v10+)
// ==========================================
export async function fetchBarangCatalog(): Promise<Barang[]> {
  try {
    const barangRef = collection(db, 'barang');
    const q = query(barangRef, orderBy('nama', 'asc'));
    const snapshot = await getDocs(q);

    const items: Barang[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.aktif !== false) {
        items.push({
          id: docSnap.id,
          nama: data.nama || 'Tanpa Nama',
          kategori: data.kategori || 'Umum',
          satuan: data.satuan || 'Pcs',
          stok: typeof data.stok === 'number' ? data.stok : 0,
          aktif: data.aktif !== false,
        });
      }
    });

    return items;
  } catch (error) {
    console.warn('Gagal fetch dengan orderBy, mencoba fetch default:', error);
    const barangRef = collection(db, 'barang');
    const snapshot = await getDocs(barangRef);
    const items: Barang[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.aktif !== false) {
        items.push({
          id: docSnap.id,
          nama: data.nama || 'Tanpa Nama',
          kategori: data.kategori || 'Umum',
          satuan: data.satuan || 'Pcs',
          stok: typeof data.stok === 'number' ? data.stok : 0,
          aktif: data.aktif !== false,
        });
      }
    });
    return items.sort((a, b) => a.nama.localeCompare(b.nama));
  }
}

// ==========================================
// 3. Sub-Komponen: Dasbor Petugas Antar
// ==========================================
function PetugasAntarDashboard({ user, profile, onLogout }: { user: any; profile: any; onLogout: () => void }) {
  const [petugasTab, setPetugasTab] = useState<'antrean' | 'riwayat'>('antrean');
  const [antaranList, setAntaranList] = useState<Permintaan[]>([]);
  const [loading, setLoading] = useState(true);

  // State Riwayat Logs
  const [riwayatLogs, setRiwayatLogs] = useState<DeliveryLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [selectedPermintaan, setSelectedPermintaan] = useState<Permintaan | null>(null);
  const [hasilPengantaran, setHasilPengantaran] = useState<'Diterima' | 'Pegawai Tidak di Tempat' | 'Ditolak Pegawai'>('Diterima');
  const [catatanPetugas, setCatatanPetugas] = useState('');
  const [isSavingLog, setIsSavingLog] = useState(false);

  // Real-time listener untuk permintaan yang berstatus "Disiapkan"
  useEffect(() => {
    const q = query(collection(db, 'permintaan'), where('status', '==', 'Disiapkan'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Permintaan[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          pegawaiId: d.pegawaiId || d.userId || '',
          namaPegawai: d.namaPegawai || 'Pegawai',
          emailPegawai: d.emailPegawai || '',
          divisi: d.divisi || 'Umum',
          status: d.status,
          tanggalPengajuan: d.tanggalPengajuan || d.createdAt,
          catatan: d.catatan || '',
          items: Array.isArray(d.items) ? d.items : [],
          totalKuantitas: d.totalKuantitas || 0,
        });
      });
      setAntaranList(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time listener untuk riwayat pengantaran milik kurir/petugas ini
  useEffect(() => {
    if (!user?.uid) return;
    const qLogs = query(
      collection(db, 'delivery_logs'),
      where('petugasId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      qLogs,
      (snapshot) => {
        const list: DeliveryLog[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            permintaanId: d.permintaanId || '',
            petugasId: d.petugasId || '',
            namaPetugas: d.namaPetugas || '',
            pegawaiId: d.pegawaiId || '',
            namaPegawai: d.namaPegawai || 'Pegawai',
            divisi: d.divisi || 'Umum',
            hasil: d.hasil || 'Diterima',
            catatan: d.catatan || '',
            timestamp: d.timestamp,
          });
        });

        // Urutkan dari yang terbaru
        list.sort((a, b) => {
          const tA = a.timestamp?.seconds || (a.timestamp ? new Date(a.timestamp).getTime() / 1000 : 0);
          const tB = b.timestamp?.seconds || (b.timestamp ? new Date(b.timestamp).getTime() / 1000 : 0);
          return tB - tA;
        });

        setRiwayatLogs(list);
        setLoadingLogs(false);
      },
      (err) => {
        console.error('Error listening to delivery logs:', err);
        setLoadingLogs(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const formatLogTime = (ts: any) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Simpan log ke koleksi delivery_logs (PRD Bagian 7)
  const handleSaveDeliveryLog = async () => {
    if (!selectedPermintaan) return;

    setIsSavingLog(true);
    try {
      await addDoc(collection(db, 'delivery_logs'), {
        permintaanId: selectedPermintaan.id,
        petugasId: user.uid,
        namaPetugas: profile?.displayName || user.email || 'Petugas Antar',
        pegawaiId: selectedPermintaan.pegawaiId, // Agar pegawai juga dapat membaca log miliknya
        namaPegawai: selectedPermintaan.namaPegawai,
        divisi: selectedPermintaan.divisi || 'Umum',
        hasil: hasilPengantaran,
        catatan: catatanPetugas.trim(),
        timestamp: serverTimestamp(),
      });

      Alert.alert(
        'Log Berhasil Dicatat! 🚚',
        `Pengantaran untuk ${selectedPermintaan.namaPegawai} dicatat sebagai: "${hasilPengantaran}".`
      );

      setSelectedPermintaan(null);
      setCatatanPetugas('');
      setHasilPengantaran('Diterima');
    } catch (err: any) {
      console.error('Error saving delivery log:', err);
      Alert.alert('Gagal Menyimpan Log', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSavingLog(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* Header Petugas */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brandSubtitle}>Sistem Permintaan Barang</Text>
          <Text style={styles.headerTitle}>Dasbor Pengantaran</Text>
          <View style={styles.userRow}>
            <View style={[styles.roleChip, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
              <Text style={[styles.roleChipText, { color: '#b45309' }]}>Petugas Antar</Text>
            </View>
            <Text style={styles.userEmail} numberOfLines={1}>
              {profile?.displayName || user?.email}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Switcher: Antrean vs Riwayat Antaran */}
      <View style={styles.petugasTabBar}>
        <TouchableOpacity
          style={[styles.petugasTabItem, petugasTab === 'antrean' && styles.petugasTabItemActive]}
          onPress={() => setPetugasTab('antrean')}
        >
          <Text style={[styles.petugasTabText, petugasTab === 'antrean' && styles.petugasTabTextActive]}>
            📦 Antrean ({antaranList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.petugasTabItem, petugasTab === 'riwayat' && styles.petugasTabItemActive]}
          onPress={() => setPetugasTab('riwayat')}
        >
          <Text style={[styles.petugasTabText, petugasTab === 'riwayat' && styles.petugasTabTextActive]}>
            📜 Riwayat Antaran ({riwayatLogs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* KONTEN TAB 1: ANTREAN PENGANTARAN */}
      {petugasTab === 'antrean' && (
        <>
          {/* Summary Info */}
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>
              Barang Siap Diantar: <Text style={styles.summaryBold}>{antaranList.length}</Text> tujuan
            </Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Siaga Antar</Text>
            </View>
          </View>

          {/* Daftar Pengantaran */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Memuat antrean pengantaran...</Text>
            </View>
          ) : antaranList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🚚</Text>
              <Text style={styles.emptyTitle}>Tidak Ada Barang Siap Diantar</Text>
              <Text style={styles.emptySubtitle}>
                Saat ini belum ada permintaan berstatus &ldquo;Disiapkan&rdquo; dari gudang.
              </Text>
            </View>
          ) : (
            <FlatList
              data={antaranList}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.petugasCard}>
                  <View style={styles.petugasCardHeader}>
                    <View>
                      <Text style={styles.petugasName}>{item.namaPegawai}</Text>
                      <Text style={styles.petugasDivisi}>Divisi: {item.divisi || 'Umum'}</Text>
                    </View>
                    <View style={styles.badgeDisiapkan}>
                      <Text style={styles.badgeDisiapkanText}>Siap Diantar</Text>
                    </View>
                  </View>

                  {/* Rincian Barang yang Dibawa */}
                  <View style={styles.petugasItemsBox}>
                    <Text style={styles.petugasItemsTitle}>Barang yang Dibawa:</Text>
                    {item.items.map((i, idx) => (
                      <Text key={idx} style={styles.petugasItemText}>
                        • <Text style={{ fontWeight: 'bold' }}>{i.namaBarang}</Text> ({i.jumlah} {i.satuan})
                      </Text>
                    ))}
                  </View>

                  {item.catatan ? (
                    <View style={styles.catatanBox}>
                      <Text style={styles.catatanBoxText}>Catatan: &ldquo;{item.catatan}&rdquo;</Text>
                    </View>
                  ) : null}

                  {/* Tombol Catat Pengantaran */}
                  <TouchableOpacity
                    style={styles.petugasActionBtn}
                    onPress={() => setSelectedPermintaan(item)}
                  >
                    <Text style={styles.petugasActionBtnText}>📝 Catat Hasil Pengantaran</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </>
      )}

      {/* KONTEN TAB 2: RIWAYAT PENGANTARAN (DELIVERY LOGS) */}
      {petugasTab === 'riwayat' && (
        <>
          {loadingLogs ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Memuat riwayat pengantaran...</Text>
            </View>
          ) : riwayatLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>Belum Ada Riwayat Pengantaran</Text>
              <Text style={styles.emptySubtitle}>
                Catatan pengantaran yang Anda simpan akan otomatis muncul di sini sebagai riwayat audit.
              </Text>
            </View>
          ) : (
            <FlatList
              data={riwayatLogs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isDiterima = item.hasil === 'Diterima';
                const isPending = item.hasil === 'Pegawai Tidak di Tempat';
                const isDitolak = item.hasil === 'Ditolak Pegawai';

                return (
                  <View style={styles.riwayatLogCard}>
                    <View style={styles.riwayatLogHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.petugasName}>{item.namaPegawai}</Text>
                        <Text style={styles.petugasDivisi}>Divisi: {item.divisi || 'Umum'}</Text>
                      </View>
                      <View
                        style={
                          isDiterima
                            ? styles.logBadgeDiterima
                            : isPending
                            ? styles.logBadgePending
                            : isDitolak
                            ? styles.logBadgeDitolak
                            : styles.logBadgeDiterima
                        }
                      >
                        <Text
                          style={
                            isDiterima
                              ? styles.logBadgeDiterimaText
                              : isPending
                              ? styles.logBadgePendingText
                              : isDitolak
                              ? styles.logBadgeDitolakText
                              : styles.logBadgeDiterimaText
                          }
                        >
                          {item.hasil}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.logTimestamp}>🕒 {formatLogTime(item.timestamp)}</Text>
                    <Text style={styles.logReqId}>No. Pengajuan: #{item.permintaanId.slice(0, 8)}</Text>

                    {item.catatan ? (
                      <View style={[styles.catatanBox, { marginTop: 8, marginBottom: 0 }]}>
                        <Text style={styles.catatanBoxText}>Catatan: &ldquo;{item.catatan}&rdquo;</Text>
                      </View>
                    ) : null}
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {/* MODAL CATAT PENGANTARAN (DELIVERY LOGS) */}
      <Modal
        visible={!!selectedPermintaan}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedPermintaan(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={styles.backdropTouch}
              activeOpacity={1}
              onPress={() => setSelectedPermintaan(null)}
            />
            <View style={styles.bottomSheet}>
              <View style={styles.dragHandle} />

              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Catat Log Pengantaran</Text>
                  <Text style={styles.modalSubtitle}>
                    Penerima: {selectedPermintaan?.namaPegawai} ({selectedPermintaan?.divisi})
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setSelectedPermintaan(null)}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ paddingHorizontal: 20, paddingTop: 14 }}>
                <Text style={styles.fieldLabel}>Hasil Pengantaran:</Text>
                <View style={styles.hasilOptions}>
                  {(['Diterima', 'Pegawai Tidak di Tempat', 'Ditolak Pegawai'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.hasilChip,
                        hasilPengantaran === opt && styles.hasilChipActive,
                      ]}
                      onPress={() => setHasilPengantaran(opt)}
                    >
                      <Text
                        style={[
                          styles.hasilChipText,
                          hasilPengantaran === opt && styles.hasilChipTextActive,
                        ]}
                      >
                        {opt === 'Diterima' ? '✓ ' : opt === 'Pegawai Tidak di Tempat' ? '⏳ ' : '✕ '}
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                  Catatan Pengantaran (Opsional):
                </Text>
                <TextInput
                  style={styles.catatanInput}
                  placeholder="Contoh: Diterima langsung di meja kerja / dititipkan di resepsionis..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  value={catatanPetugas}
                  onChangeText={setCatatanPetugas}
                />

                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxText}>
                    ℹ️ Log pengantaran ini akan disimpan permanen ke koleksi delivery_logs sebagai audit trail proses pengantaran.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, { marginTop: 16, marginBottom: 24 }]}
                  onPress={handleSaveDeliveryLog}
                  disabled={isSavingLog}
                >
                  {isSavingLog ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Simpan Log Pengantaran</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================
// 4. Sub-Komponen: Riwayat Permintaan Pegawai
// ==========================================
function RiwayatPegawaiView({ user }: { user: any }) {
  const [riwayat, setRiwayat] = useState<Permintaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Real-time listener riwayat permintaan milik pegawai
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'permintaan'),
      where('pegawaiId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Permintaan[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          pegawaiId: d.pegawaiId,
          namaPegawai: d.namaPegawai,
          divisi: d.divisi,
          status: d.status,
          tanggalPengajuan: d.tanggalPengajuan || d.createdAt,
          createdAt: d.createdAt,
          catatan: d.catatan || '',
          items: Array.isArray(d.items) ? d.items : [],
          totalKuantitas: d.totalKuantitas || 0,
        });
      });

      // Sort tanggal terbaru
      items.sort((a, b) => {
        const tA = a.tanggalPengajuan?.seconds || 0;
        const tB = b.tanggalPengajuan?.seconds || 0;
        return tB - tA;
      });

      setRiwayat(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Handler Konfirmasi Penerimaan Barang (PRD Bagian 4 & 5)
  const handleConfirmReceived = (permintaan: Permintaan) => {
    Alert.alert(
      'Konfirmasi Penerimaan',
      'Apakah Anda telah menerima seluruh barang fisik dari permohonan ini dengan baik?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Sudah Diterima',
          style: 'default',
          onPress: async () => {
            setConfirmingId(permintaan.id);
            try {
              const reqRef = doc(db, 'permintaan', permintaan.id);
              await updateDoc(reqRef, {
                status: 'Diterima',
                waktuDiterima: serverTimestamp(),
                waktuSelesai: serverTimestamp(),
              });
              Alert.alert('Sukses 🎉', 'Barang berhasil dikonfirmasi diterima. Terima kasih!');
            } catch (err: any) {
              console.error('Error confirming receipt:', err);
              Alert.alert('Gagal Mengonfirmasi', err.message || 'Terjadi kesalahan sistem.');
            } finally {
              setConfirmingId(null);
            }
          },
        },
      ]
    );
  };

  const formatTanggal = (timestamp: any) => {
    if (!timestamp) return '-';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Memuat riwayat permintaan Anda...</Text>
      </View>
    );
  }

  if (riwayat.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>Belum Ada Riwayat Permintaan</Text>
        <Text style={styles.emptySubtitle}>
          Anda belum pernah mengajukan barang. Silakan buka tab &ldquo;Katalog&rdquo; untuk membuat pengajuan baru.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={riwayat}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.listContent, { paddingTop: 12, paddingBottom: 40 }]}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const isDisiapkan = item.status === 'Disiapkan';
        const isDiterima = item.status === 'Diterima';
        const isMenunggu = item.status === 'Menunggu Persetujuan';
        const isConfirming = confirmingId === item.id;

        return (
          <View style={[styles.riwayatCard, isDisiapkan && styles.riwayatCardHighlight]}>
            <View style={styles.riwayatHeader}>
              <Text style={styles.riwayatDate}>{formatTanggal(item.tanggalPengajuan)}</Text>
              
              {/* Status Badge */}
              {isMenunggu ? (
                <View style={styles.badgeMenunggu}>
                  <Text style={styles.badgeMenungguText}>⏳ Menunggu Admin</Text>
                </View>
              ) : isDisiapkan ? (
                <View style={styles.badgeDisiapkan}>
                  <Text style={styles.badgeDisiapkanText}>📦 Barang Disiapkan</Text>
                </View>
              ) : isDiterima ? (
                <View style={styles.badgeInStock}>
                  <Text style={styles.badgeInStockText}>✓ Diterima</Text>
                </View>
              ) : (
                <View style={styles.badgeOutOfStock}>
                  <Text style={styles.badgeOutOfStockText}>✕ Ditolak</Text>
                </View>
              )}
            </View>

            {/* Rincian Barang */}
            <View style={styles.riwayatItemsBox}>
              {item.items.map((it, idx) => (
                <View key={idx} style={styles.riwayatItemRow}>
                  <Text style={styles.riwayatItemName}>{it.namaBarang}</Text>
                  <Text style={styles.riwayatItemQty}>
                    {it.jumlah} {it.satuan}
                  </Text>
                </View>
              ))}
            </View>

            {item.catatan ? (
              <Text style={styles.riwayatCatatan}>Catatan: &ldquo;{item.catatan}&rdquo;</Text>
            ) : null}

            {/* TOMBOL KONFIRMASI DITERIMA (HANYA MUNCUL SAAT STATUS "Disiapkan") */}
            {isDisiapkan && (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmBoxInfo}>
                  Barang telah disetujui dan disiapkan. Tekan tombol ini setelah Anda menerima barang fisik:
                </Text>
                <TouchableOpacity
                  style={[styles.confirmButton, isConfirming && styles.confirmButtonDisabled]}
                  onPress={() => handleConfirmReceived(item)}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.confirmButtonText}>✓ Konfirmasi Diterima</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

// ==========================================
// 5. Komponen Utama Dashboard Pegawai / Switcher
// ==========================================
function DashboardContent() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Zustand Cart Store
  const { 
    items: cartItems, 
    addItem, 
    removeItem, 
    incrementJumlah, 
    decrementJumlah, 
    clearCart, 
    getTotalItems, 
    getItemCount 
  } = useCart();

  // Tab View Pegawai: 'katalog' | 'riwayat'
  const [pegawaiTab, setPegawaiTab] = useState<'katalog' | 'riwayat'>('katalog');

  // State Katalog
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [isCartModalVisible, setIsCartModalVisible] = useState(false);
  const [catatanPengajuan, setCatatanPengajuan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // React Query: Fetching Katalog Barang
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<Barang[], Error>({
    queryKey: ['katalog-barang'],
    queryFn: fetchBarangCatalog,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
  });

  const totalCartCount = getTotalItems();

  // Ekstrak kategori
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.kategori?.trim()) {
        set.add(item.kategori.trim());
      }
    });
    return ['Semua', ...Array.from(set)];
  }, [items]);

  // Filter pencarian
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCategory =
        selectedCategory === 'Semua' ||
        item.kategori.toLowerCase() === selectedCategory.toLowerCase();

      const queryClean = searchQuery.trim().toLowerCase();
      const matchSearch =
        queryClean === '' ||
        item.nama.toLowerCase().includes(queryClean) ||
        item.kategori.toLowerCase().includes(queryClean);

      return matchCategory && matchSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // Ringkasan stok
  const summary = useMemo(() => {
    const totalTersedia = items.filter((i) => i.stok > 0).length;
    const totalHabis = items.filter((i) => i.stok === 0).length;
    return { totalTersedia, totalHabis };
  }, [items]);

  // Logout
  const handleLogout = () => {
    Alert.alert('Konfirmasi Keluar', 'Apakah Anda yakin ingin keluar dari aplikasi?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace('/');
          } catch (err: any) {
            Alert.alert('Gagal Keluar', err.message);
          }
        },
      },
    ]);
  };

  // Tambah item ke keranjang
  const handleAddToCart = (barang: Barang) => {
    if (barang.stok === 0) {
      Alert.alert('Stok Habis', `Barang "${barang.nama}" sedang tidak tersedia di gudang.`);
      return;
    }

    const currentQtyInCart = getItemCount(barang.id);
    if (currentQtyInCart >= barang.stok) {
      Alert.alert(
        'Batas Stok Tercapai',
        `Jumlah di keranjang sudah mencapai batas stok (${barang.stok} ${barang.satuan}).`
      );
      return;
    }

    addItem({
      id: barang.id,
      nama: barang.nama,
      kategori: barang.kategori,
      satuan: barang.satuan,
      stok: barang.stok,
    });
  };

  // Submit pengajuan ke Firestore
  const handleSubmitPengajuan = async () => {
    if (cartItems.length === 0 || !user) return;

    setIsSubmitting(true);
    try {
      const payload = {
        userId: user.uid,
        pegawaiId: user.uid,
        namaPegawai: profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Pegawai',
        emailPegawai: user.email || '',
        divisi: profile?.divisi || 'Umum',
        status: 'Menunggu Persetujuan',
        tanggalPengajuan: serverTimestamp(),
        createdAt: serverTimestamp(),
        catatan: catatanPengajuan.trim(),
        items: cartItems.map((c) => ({
          barangId: c.barangId,
          namaBarang: c.nama,
          kategori: c.kategori,
          satuan: c.satuan,
          jumlah: c.jumlah,
        })),
        totalJenisBarang: cartItems.length,
        totalKuantitas: getTotalItems(),
      };

      await addDoc(collection(db, 'permintaan'), payload);

      clearCart();
      setCatatanPengajuan('');
      setIsCartModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['katalog-barang'] });

      Alert.alert(
        'Pengajuan Berhasil! 🎉',
        'Permintaan barang Anda telah berhasil diajukan dan sedang menunggu persetujuan dari Admin Gudang.'
      );
      // Alihkan ke tab riwayat agar pegawai langsung melihat statusnya
      setPegawaiTab('riwayat');
    } catch (err: any) {
      console.error('[SUBMIT ERROR]:', err);
      Alert.alert('Gagal Mengajukan Permintaan', err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // JIKA ROLE ADALAH PETUGAS: Tampilkan Dasbor Petugas Antar
  if (profile?.role === 'petugas') {
    return <PetugasAntarDashboard user={user} profile={profile} onLogout={handleLogout} />;
  }

  // JIKA ROLE ADALAH PEGAWAI:
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* Header Utama Pegawai */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brandSubtitle}>Sistem Permintaan Barang</Text>
          <Text style={styles.headerTitle}>Dasbor Pegawai</Text>
          <View style={styles.userRow}>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>Pegawai</Text>
            </View>
            <Text style={styles.userEmail} numberOfLines={1}>
              {profile?.displayName || user?.email || 'karyawan1@gudang.com'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      {/* SEGMENTED TAB SWITCHER: KATALOG vs RIWAYAT */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabButton, pegawaiTab === 'katalog' && styles.tabButtonActive]}
          onPress={() => setPegawaiTab('katalog')}
        >
          <Text style={[styles.tabButtonText, pegawaiTab === 'katalog' && styles.tabButtonTextActive]}>
            📦 Katalog Barang
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, pegawaiTab === 'riwayat' && styles.tabButtonActive]}
          onPress={() => setPegawaiTab('riwayat')}
        >
          <Text style={[styles.tabButtonText, pegawaiTab === 'riwayat' && styles.tabButtonTextActive]}>
            📋 Riwayat Saya
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAMPILAN TAB 1: KATALOG BARANG */}
      {pegawaiTab === 'katalog' ? (
        <>
          {/* SEARCH BAR */}
          <View style={styles.searchSection}>
            <View style={styles.searchInputContainer}>
              <Text style={styles.searchIconText}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama atau kategori barang..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* FILTER KATEGORI */}
          <View style={styles.categorySection}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={categories}
              keyExtractor={(cat) => cat}
              contentContainerStyle={styles.categoryList}
              renderItem={({ item: cat }) => {
                const isSelected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    onPress={() => setSelectedCategory(cat)}
                    style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                  >
                    <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* RINGKASAN STOK */}
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>
              Menampilkan <Text style={styles.summaryBold}>{filteredItems.length}</Text> barang
            </Text>
            <View style={styles.summaryBadges}>
              <Text style={styles.summaryTagTersedia}>{summary.totalTersedia} Tersedia</Text>
              {summary.totalHabis > 0 && (
                <Text style={styles.summaryTagHabis}>{summary.totalHabis} Habis</Text>
              )}
            </View>
          </View>

          {/* LIST BARANG */}
          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Memuat katalog barang...</Text>
            </View>
          ) : isError ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorTitle}>Gagal memuat katalog barang</Text>
              <Text style={styles.errorMessage}>{error?.message || 'Terjadi kesalahan sistem.'}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                <Text style={styles.retryButtonText}>Coba Lagi</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: totalCartCount > 0 ? 100 : 32 },
              ]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={['#2563eb']} tintColor="#2563eb" />
              }
              renderItem={({ item }) => {
                const isOutOfStock = item.stok === 0;
                const isLowStock = item.stok > 0 && item.stok <= 5;
                const qtyInCart = getItemCount(item.id);

                return (
                  <View style={[styles.itemCard, isOutOfStock && styles.itemCardDisabled, qtyInCart > 0 && styles.itemCardSelected]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.categoryBadge, isOutOfStock && styles.categoryBadgeDisabled]}>
                        <Text style={[styles.categoryBadgeText, isOutOfStock && styles.categoryBadgeTextDisabled]}>
                          {item.kategori}
                        </Text>
                      </View>

                      {isOutOfStock ? (
                        <View style={styles.badgeOutOfStock}><Text style={styles.badgeOutOfStockText}>Stok Habis</Text></View>
                      ) : isLowStock ? (
                        <View style={styles.badgeLowStock}><Text style={styles.badgeLowStockText}>Sisa {item.stok} {item.satuan}</Text></View>
                      ) : (
                        <View style={styles.badgeInStock}><Text style={styles.badgeInStockText}>Stok: {item.stok} {item.satuan}</Text></View>
                      )}
                    </View>

                    <Text style={[styles.itemName, isOutOfStock && styles.itemNameDisabled]} numberOfLines={2}>
                      {item.nama}
                    </Text>

                    <View style={styles.cardFooter}>
                      <Text style={[styles.satuanText, isOutOfStock && styles.satuanTextDisabled]}>
                        Satuan: <Text style={styles.satuanBold}>{item.satuan}</Text>
                      </Text>

                      {isOutOfStock ? (
                        <View style={styles.actionPillDisabled}><Text style={styles.actionPillDisabledText}>Tidak Tersedia</Text></View>
                      ) : qtyInCart > 0 ? (
                        <TouchableOpacity style={styles.actionPillInCart} onPress={() => handleAddToCart(item)}>
                          <Text style={styles.actionPillInCartText}>✓ Terpilih ({qtyInCart})</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={styles.actionPillAvailable} onPress={() => handleAddToCart(item)}>
                          <Text style={styles.actionPillAvailableText}>+ Pilih Barang</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* FAB KERANJANG */}
          {totalCartCount > 0 && (
            <View style={styles.fabContainer}>
              <TouchableOpacity activeOpacity={0.85} style={styles.fabButton} onPress={() => setIsCartModalVisible(true)}>
                <View style={styles.fabLeft}>
                  <View style={styles.fabBadge}><Text style={styles.fabBadgeText}>{totalCartCount}</Text></View>
                  <Text style={styles.fabTitle}>Keranjang Permintaan</Text>
                </View>
                <View style={styles.fabRight}>
                  <Text style={styles.fabActionText}>Lihat & Ajukan</Text>
                  <Text style={styles.fabArrow}>→</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* MODAL KERANJANG */}
          <Modal visible={isCartModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsCartModalVisible(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
              <View style={styles.modalBackdrop}>
                <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={() => setIsCartModalVisible(false)} />
                <View style={styles.bottomSheet}>
                  <View style={styles.dragHandle} />
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalTitle}>Keranjang Permintaan</Text>
                      <Text style={styles.modalSubtitle}>{cartItems.length} jenis ({totalCartCount} unit)</Text>
                    </View>
                    <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsCartModalVisible(false)}>
                      <Text style={styles.modalCloseText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.cartListScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.cartItemsWrapper}>
                      {cartItems.map((cItem) => {
                        const isMaxStock = cItem.jumlah >= cItem.stok;
                        return (
                          <View key={cItem.barangId} style={styles.cartRowCard}>
                            <View style={styles.cartRowInfo}>
                              <Text style={styles.cartRowBadgeText}>{cItem.kategori}</Text>
                              <Text style={styles.cartRowName} numberOfLines={2}>{cItem.nama}</Text>
                              <Text style={styles.cartRowStockInfo}>Stok gudang: {cItem.stok} {cItem.satuan}</Text>
                            </View>
                            <View style={styles.stepperContainer}>
                              <TouchableOpacity style={styles.stepperButton} onPress={() => decrementJumlah(cItem.barangId)}>
                                <Text style={styles.stepperButtonText}>−</Text>
                              </TouchableOpacity>
                              <View style={styles.stepperQtyBox}>
                                <Text style={styles.stepperQtyText}>{cItem.jumlah}</Text>
                                <Text style={styles.stepperSatuanText}>{cItem.satuan}</Text>
                              </View>
                              <TouchableOpacity disabled={isMaxStock} style={[styles.stepperButton, isMaxStock && styles.stepperButtonDisabled]} onPress={() => incrementJumlah(cItem.barangId)}>
                                <Text style={[styles.stepperButtonText, isMaxStock && styles.stepperButtonTextDisabled]}>+</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.cartRowDeleteButton} onPress={() => removeItem(cItem.barangId)}>
                                <Text style={styles.cartRowDeleteText}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.catatanContainer}>
                      <Text style={styles.catatanLabel}>Catatan Pengajuan (Opsional)</Text>
                      <TextInput
                        style={styles.catatanInput}
                        placeholder="Contoh: Kebutuhan operasional ATK divisi..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={3}
                        value={catatanPengajuan}
                        onChangeText={setCatatanPengajuan}
                      />
                    </View>
                  </ScrollView>

                  {cartItems.length > 0 && (
                    <View style={styles.modalFooter}>
                      <TouchableOpacity style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} onPress={handleSubmitPengajuan} disabled={isSubmitting}>
                        {isSubmitting ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <Text style={styles.submitButtonText}>Ajukan Permintaan ({totalCartCount} Barang)</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </>
      ) : (
        /* TAMPILAN TAB 2: RIWAYAT PERMINTAAN PEGAWAI */
        <RiwayatPegawaiView user={user} />
      )}
    </SafeAreaView>
  );
}

// ==========================================
// 6. Safe React Query Provider Wrapper
// ==========================================
const fallbackQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3,
      retry: 2,
    },
  },
});

export default function DashboardScreen() {
  let hasExistingClient = true;
  try {
    hasExistingClient = !!useQueryClient();
  } catch {
    hasExistingClient = false;
  }

  if (hasExistingClient) {
    return <DashboardContent />;
  }

  return (
    <QueryClientProvider client={fallbackQueryClient}>
      <DashboardContent />
    </QueryClientProvider>
  );
}

// ==========================================
// 7. Stylesheet
// ==========================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  roleChip: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    flexShrink: 1,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  logoutButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  // Segmented Tab Switcher (Pegawai)
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    padding: 3,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },

  // Search
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: '#f8fafc',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    height: 42,
  },
  searchIconText: { fontSize: 13, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
  clearSearchButton: { padding: 4 },
  clearSearchText: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold' },

  // Categories
  categorySection: { paddingVertical: 4 },
  categoryList: { paddingHorizontal: 16, gap: 8 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  categoryChipText: { fontSize: 12, fontWeight: '500', color: '#64748b' },
  categoryChipTextActive: { color: '#ffffff', fontWeight: '700' },

  // Summary Bar
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  summaryText: { fontSize: 12, color: '#64748b' },
  summaryBold: { fontWeight: '700', color: '#0f172a' },
  summaryBadges: { flexDirection: 'row', gap: 6 },
  summaryTagTersedia: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16a34a',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  summaryTagHabis: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  // Live Indicator
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  liveText: { fontSize: 11, fontWeight: 'bold', color: '#15803d' },

  // Lists
  listContent: { paddingHorizontal: 16, gap: 12 },

  // Catalog Item Card
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemCardDisabled: { backgroundColor: '#f8fafc', opacity: 0.62 },
  itemCardSelected: { borderColor: '#93c5fd', backgroundColor: '#f8faff' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  categoryBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryBadgeDisabled: { backgroundColor: '#f1f5f9' },
  categoryBadgeText: { fontSize: 11, fontWeight: '600', color: '#2563eb' },
  categoryBadgeTextDisabled: { color: '#94a3b8' },
  badgeInStock: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeInStockText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  badgeLowStock: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeLowStockText: { fontSize: 11, fontWeight: '700', color: '#b45309' },
  badgeOutOfStock: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeOutOfStockText: { fontSize: 11, fontWeight: '700', color: '#b91c1c' },
  badgeDisiapkan: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeDisiapkanText: { fontSize: 11, fontWeight: '700', color: '#1e40af' },
  badgeMenunggu: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeMenungguText: { fontSize: 11, fontWeight: '700', color: '#b45309' },

  itemName: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  itemNameDisabled: { color: '#64748b' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  satuanText: { fontSize: 12, color: '#64748b' },
  satuanTextDisabled: { color: '#94a3b8' },
  satuanBold: { fontWeight: '600', color: '#334155' },

  actionPillAvailable: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  actionPillAvailableText: { fontSize: 11, fontWeight: '600', color: '#ffffff' },
  actionPillInCart: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#3b82f6' },
  actionPillInCartText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  actionPillDisabled: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  actionPillDisabledText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },

  // Riwayat Card
  riwayatCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  riwayatCardHighlight: {
    borderColor: '#93c5fd',
    backgroundColor: '#fcfdff',
  },
  riwayatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  riwayatDate: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  riwayatItemsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    gap: 4,
    marginBottom: 8,
  },
  riwayatItemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  riwayatItemName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  riwayatItemQty: { fontSize: 13, fontWeight: 'bold', color: '#2563eb' },
  riwayatCatatan: { fontSize: 11, color: '#64748b', fontStyle: 'italic', marginBottom: 8 },

  confirmBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  confirmBoxInfo: { fontSize: 11, color: '#0369a1', marginBottom: 8, lineHeight: 16 },
  confirmButton: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmButtonDisabled: { backgroundColor: '#86efac' },
  confirmButtonText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },

  // Petugas Card
  petugasCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  petugasCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  petugasName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  petugasDivisi: { fontSize: 12, color: '#64748b', marginTop: 2 },
  petugasItemsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
  },
  petugasItemsTitle: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
  petugasItemText: { fontSize: 12, color: '#334155', lineHeight: 18 },
  catatanBox: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 6, marginBottom: 10 },
  catatanBoxText: { fontSize: 11, color: '#475569', fontStyle: 'italic' },
  petugasActionBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  petugasActionBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },

  // Delivery Modal Options
  fieldLabel: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginBottom: 8 },
  hasilOptions: { gap: 8 },
  hasilChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  hasilChipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  hasilChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  hasilChipTextActive: { color: '#1d4ed8', fontWeight: 'bold' },

  // FAB
  fabContainer: { position: 'absolute', bottom: 20, left: 16, right: 16, zIndex: 40 },
  fabButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 6,
  },
  fabLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fabBadge: { backgroundColor: '#ffffff', borderRadius: 12, minWidth: 24, height: 24, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  fabBadgeText: { color: '#2563eb', fontSize: 12, fontWeight: 'bold' },
  fabTitle: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  fabRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fabActionText: { color: '#dbeafe', fontSize: 13, fontWeight: '600' },
  fabArrow: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  // BottomSheet & Modal
  modalOverlay: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  bottomSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 24 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#cbd5e1', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  modalSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  modalCloseButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 14, color: '#64748b', fontWeight: 'bold' },
  cartListScroll: { maxHeight: 380, paddingHorizontal: 20, paddingTop: 12 },
  cartItemsWrapper: { gap: 10 },
  cartRowCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartRowInfo: { flex: 1, marginRight: 12 },
  cartRowBadgeText: { fontSize: 10, fontWeight: '600', color: '#2563eb', marginBottom: 2 },
  cartRowName: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  cartRowStockInfo: { fontSize: 11, color: '#64748b', marginTop: 2 },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepperButton: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  stepperButtonDisabled: { backgroundColor: '#f1f5f9', opacity: 0.5 },
  stepperButtonText: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  stepperButtonTextDisabled: { color: '#94a3b8' },
  stepperQtyBox: { minWidth: 38, alignItems: 'center' },
  stepperQtyText: { fontSize: 15, fontWeight: 'bold', color: '#2563eb' },
  stepperSatuanText: { fontSize: 9, color: '#64748b' },
  cartRowDeleteButton: { padding: 6, marginLeft: 2 },
  cartRowDeleteText: { fontSize: 14, color: '#ef4444', fontWeight: 'bold' },
  catatanContainer: { marginTop: 14 },
  catatanLabel: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 6 },
  catatanInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a', minHeight: 60, textAlignVertical: 'top' },
  infoBox: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#dbeafe' },
  infoBoxText: { fontSize: 11, color: '#1e40af', lineHeight: 16 },
  modalFooter: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  submitButton: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  submitButtonDisabled: { backgroundColor: '#93c5fd' },
  submitButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  // Center / Loading / Empty / Error
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 44, marginBottom: 10, opacity: 0.6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18 },
  errorIcon: { fontSize: 36, marginBottom: 8 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  errorMessage: { fontSize: 13, color: '#ef4444', textAlign: 'center', marginBottom: 16 },
  retryButton: { backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  retryButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },

  // Petugas Tab Switcher
  petugasTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  petugasTabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  petugasTabItemActive: {
    borderBottomColor: '#2563eb',
  },
  petugasTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  petugasTabTextActive: {
    color: '#2563eb',
    fontWeight: 'bold',
  },

  // Riwayat Delivery Log Cards
  riwayatLogCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  riwayatLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  logBadgeDiterima: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  logBadgeDiterimaText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: 'bold',
  },
  logBadgePending: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  logBadgePendingText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: 'bold',
  },
  logBadgeDitolak: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  logBadgeDitolakText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: 'bold',
  },
  logTimestamp: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  logReqId: {
    fontSize: 11,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
});
