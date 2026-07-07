'use strict';
/* Bilingual dictionary (English -> Indonesian) + date/label helpers.
 * The UI is authored in English; when the language is set to Indonesian the
 * client localizes the freshly-rendered DOM + toasts via this table.
 * Loaded before app.js so window.__I18N is ready at mount time. */
window.__I18N = (function () {
  var dict = {
    // ---- nav / shell ----
    'Schedule': 'Jadwal', 'Team Schedule': 'Jadwal Tim', 'Coach Monitoring': 'Monitoring Coach',
    'Reports': 'Laporan', 'Account': 'Akun', 'Settings': 'Pengaturan', 'Permissions': 'Hak Akses',
    'Class Menu': 'Menu Kelas', 'Participants': 'Peserta', 'Logout': 'Keluar',
    'Appreciation Email': 'Email Apresiasi', 'Coach Workspace': 'Coach Workspace',
    // ---- top bar / kickers ----
    'Coach': 'Coach', 'Head Coach': 'Head Coach', 'Admin': 'Admin', 'Administrator': 'Administrator',
    'Synced with Admin Hub': 'Tersinkron dengan Admin Hub',
    // ---- login ----
    'Welcome back': 'Selamat datang', 'Sign in to your account': 'Masuk ke akun Anda',
    'Name': 'Nama', 'Password': 'Password', 'Login': 'Masuk',
    'Forgot your password? Passwords are created & reset by': 'Lupa password? Password dibuat & direset oleh',
    '. Contact your Admin for help.': '. Hubungi Admin Anda untuk bantuan.',
    'username or email': 'username atau email',
    'Active Coaches': 'Coach Aktif', 'Location · Menteng': 'Lokasi · Menteng',
    // ---- dashboard ----
    'Classes This Month': 'Kelas Bulan Ini', 'Participants Served': 'Peserta Dilayani',
    "This Week's Calendar": 'Kalender Minggu Ini', 'Recent History': 'Riwayat Terakhir',
    'Has a class · click a date to see its schedule': 'Ada kelas ngajar · klik tanggal untuk lihat jadwalnya',
    'No classes on this date.': 'Tidak ada kelas di tanggal ini.',
    'VENUE BOOKING + COACH': 'VENUE BOOKING + COACH', 'Arena + Coach': 'Arena + Coach', 'Arena': 'Arena',
    'In progress': 'Sedang berlangsung',
    // ---- class detail ----
    'Class Detail': 'Detail Kelas', 'Change Coach': 'Ganti Coach', 'Start Class': 'Mulai Kelas',
    'Participant List': 'Daftar Peserta', 'Class booking': 'Booking kelas',
    // ---- coverage / substitution ----
    'Request Coverage': 'Ajukan Coverage', 'SELECT COVERAGE COACH': 'PILIH COACH COVERAGE',
    'REASON (OPTIONAL)': 'ALASAN (OPSIONAL)', 'Submit to Head Coach': 'Kirim ke Head Coach',
    'Send Coverage Request': 'Kirim Permintaan Coverage',
    'AWAITING YOUR APPROVAL': 'MENUNGGU PERSETUJUAN ANDA', 'COVERAGE NOTIFICATIONS': 'NOTIFIKASI COVERAGE',
    'COVERAGE HISTORY': 'RIWAYAT COVERAGE', 'No pending requests ✓': 'Tidak ada permintaan menunggu ✓',
    'All requests have been handled ✓': 'Semua permintaan sudah ditindak ✓', 'Coverage': 'Coverage',
    // ---- feedback ----
    'Participant Feedback': 'Feedback Peserta',
    'Write feedback for each participant who attended. Feedback is sent to each participant\'s email.': 'Tulis feedback untuk tiap peserta yang hadir. Feedback dikirim ke email masing-masing peserta.',
    'Select Class': 'Pilih Kelas', 'Send Feedback': 'Kirim Feedback',
    'Select a class first to write feedback for its participants.': 'Pilih kelas dulu untuk menulis feedback pesertanya.',
    'No confirmed participants in this class yet.': 'Belum ada peserta confirmed di kelas ini.',
    // ---- overview / schedule ----
    "Today's Schedule — All Coaches": 'Jadwal Hari Ini — Seluruh Coach', 'Not Checked In': 'Belum Absen',
    'No classes scheduled for this day.': 'Tidak ada kelas terjadwal pada hari ini.',
    // ---- monitoring / stats ----
    'Class Monitoring': 'Monitoring Kelas', 'classes': 'kelas', 'attended': 'hadir', 'visits': 'kali datang',
    'Total Classes': 'Total Kelas', 'Attendance': 'Kehadiran', 'Substitutions': 'Penggantian',
    'Per-Class Breakdown': 'Rincian per Kelas', 'Active Last 30 Days': 'Aktif 30 Hari Terakhir',
    'My Participants': 'Peserta Saya', 'Coach Leaderboard': 'Leaderboard Coach',
    'No participants recorded as attending your classes yet.': 'Belum ada peserta yang tercatat hadir di kelas Anda.',
    'No participant booking data yet.': 'Belum ada data booking peserta.',
    // ---- reviews ----
    'Participant Reviews': 'Review Peserta', 'Average ★': 'Rata-rata ★', 'Total reviews': 'Total review',
    'Copy Link': 'Salin Link',
    // ---- venue ----
    'No coach yet': 'Belum ada coach', 'Time not set': 'Jam belum diatur', 'Remove': 'Hapus',
    'No upcoming arena bookings.': 'Belum ada booking arena mendatang.', 'Flexible time': 'Jam fleksibel',
    'Add to Google Calendar': 'Tambah ke Google Calendar',
    'Calendar reminder created (2 days & 12 hours before).': 'Pengingat kalender dibuat (2 hari & 12 jam sebelumnya).',
    'Booking date not available.': 'Tanggal booking tidak tersedia.',
    // ---- menu ----
    'Edit Menu': 'Edit Menu', 'Cancel': 'Batal', 'MENU LIST': 'DAFTAR MENU', 'Edit': 'Edit',
    'Menu / Session Name': 'Nama Menu / Sesi', 'Class Type': 'Jenis Kelas', 'Menu / Program Content': 'Isi Menu / Program',
    'Save Menu': 'Simpan Menu', 'Update Menu': 'Update Menu', 'Add New Menu': 'Tambah Menu Baru',
    // ---- reports ----
    'This Month': 'Bulan Ini', 'This Week': 'Minggu Ini', 'Total Classes (team)': 'Total Kelas (tim)',
    // ---- accounts / add coach ----
    'Passwords are created & shared manually by the Admin (format: name + number).': 'Password dibuat & dibagikan manual oleh Admin (format: nama + angka).',
    'Reset Password': 'Reset Password', 'Deactivate': 'Nonaktifkan', 'Activate': 'Aktifkan',
    'Add New Coach': 'Tambah Coach Baru', 'Full Name': 'Nama Lengkap', 'Phone Number': 'Nomor Telepon',
    'Initial Password': 'Password Awal', 'Save New Coach': 'Simpan Coach Baru',
    // ---- settings ----
    'Check-In Button Time Window': 'Rentang Waktu Tombol Absen', 'Location Lock for Check-In (GPS)': 'Kunci Lokasi saat Absen (GPS)',
    'Use My Location Now': 'Pakai Lokasi Saya Sekarang', 'Radius': 'Radius', 'meters': 'meter',
    'Disable Lock': 'Matikan Kunci', 'Set': 'Ditetapkan',
    // ---- permissions ----
    'View own class schedule & participants': 'Lihat jadwal & peserta kelas sendiri',
    'Check in to own classes': 'Absen kelas sendiri', 'Request coverage (own classes)': 'Ajukan coverage (kelas sendiri)',
    'View all coaches’ schedules': 'Lihat jadwal seluruh coach', 'Change teaching coach (any class)': 'Ubah coach pengajar (kelas mana pun)',
    'Approve / Cancel coverage': 'Approve / Cancel coverage', 'View all coaches’ attendance': 'Lihat absensi seluruh coach',
    'Access & export all-coach reports': 'Akses & ekspor laporan seluruh coach', 'Manage appreciation message templates': 'Kelola template pesan apresiasi',
    'Add accounts & set initial password': 'Tambah akun & set password awal', 'Reset coach passwords': 'Reset password coach',
    'Deactivate coach accounts': 'Nonaktifkan akun coach', 'Set user roles': 'Atur role pengguna',
    'Admin is a superset of Head Coach plus account management permissions.': 'Admin adalah superset Head Coach + kewenangan kelola akun.',
    // ---- modals ----
    'Start Class Now?': 'Mulai Kelas Sekarang?', 'Approve': 'Setujui', 'Reject': 'Tolak',
    'Set Password': 'Set Password',
    'New Password (type it yourself)': 'Password Baru (ketik sendiri)',
    // ---- table headers ----
    'NAME': 'NAMA', 'BOOKING': 'BOOKING', 'STATUS': 'STATUS', 'TIME': 'JAM', 'COACH · CLASS': 'COACH · KELAS',
    'CHECK-IN': 'ABSEN', 'DATE': 'TGL', 'DAY': 'HARI', 'CLASS TYPE': 'JENIS KELAS', 'PAX': 'PAX',
    'CLASSES': 'KELAS', 'COVERED': 'DIGANTI', 'ACTION': 'AKSI', 'COACH': 'COACH', 'ADMIN': 'ADMIN',
    'HEAD COACH': 'HEAD COACH',
    // ---- status labels ----
    'Upcoming': 'Akan Datang', 'In Progress': 'Sedang Berlangsung', 'Scheduled': 'Terjadwal',
    'Teaching': 'Mengajar', 'Completed': 'Selesai', 'Confirmed': 'Confirmed', 'Checked-in': 'Hadir',
    'No-show': 'Tidak Hadir', 'Approved': 'Disetujui', 'Rejected': 'Ditolak', 'Pending': 'Menunggu',
    'Sent': 'Terkirim', 'Failed': 'Gagal', 'Active': 'Aktif', 'Inactive': 'Nonaktif',
    // ---- recency ----
    'First time': 'Pertama kali', 'Today': 'Hari ini', 'Yesterday': 'Kemarin',
    // ---- empty states with emoji (matched emoji-stripped) ----
    'No reviews yet. Share the link above with your participants': 'Belum ada review. Bagikan link di atas ke peserta Anda',
    'No class menus yet. Add the first one above': 'Belum ada menu kelas. Tambahkan yang pertama di atas',
    // ---- toasts (full) ----
    'Class started · attendance recorded': 'Kelas dimulai · kehadiran tercatat',
    'Checking your location…': 'Mengecek lokasi kamu…', 'Menu updated': 'Menu diperbarui',
    'Class menu saved': 'Menu kelas tersimpan', 'Menu deleted': 'Menu dihapus',
    'This device does not support GPS.': 'Perangkat tidak mendukung GPS.',
    'Getting your location…': 'Mengambil lokasi kamu…',
    'Arena location saved · check-in is now locked to this location': 'Lokasi arena tersimpan · absen kini dikunci ke lokasi ini',
    'Failed to get location. Enable location access and try again.': 'Gagal ambil lokasi. Aktifkan izin lokasi lalu coba lagi.',
    'Location lock disabled': 'Kunci lokasi dimatikan', 'Select a coverage coach first.': 'Pilih coach coverage dulu.',
    'Coverage approved': 'Coverage disetujui', 'Coverage rejected': 'Coverage ditolak',
    'Coverage approved · this is now your class': 'Coverage disetujui · kelas kini kelas Anda',
    'Review link copied': 'Link review disalin', 'Type a new password first.': 'Ketik password baru dulu.',
    'Password reset · share it with the coach': 'Password direset · sampaikan ke coach',
    'New coach added · Active': 'Coach baru ditambahkan · Active', 'File is being prepared for download': 'File sedang disiapkan untuk diunduh',
    'Select a class first.': 'Pilih kelas dulu.', 'Write at least one feedback first.': 'Isi minimal satu feedback dulu.',
    'Coach assignment removed': 'Assign coach dibatalkan', 'Template added': 'Template ditambahkan',
    'No data to export.': 'Belum ada data untuk diekspor.', 'CSV file downloaded': 'File CSV diunduh',
    'You do not have access to this area.': 'Tidak punya akses ke area ini.', 'Failed to load.': 'Gagal memuat.',
    'Email/username & password are required.': 'Email/username & password wajib diisi.', 'Login failed.': 'Login gagal.',
    'Menu name & content are required.': 'Nama menu & isi menu wajib diisi.', 'Coach name is required.': 'Nama coach wajib diisi.',
    'Select a from & to date.': 'Pilih tanggal dari & sampai.', 'The "from" date must be before the "to" date.': 'Tanggal "dari" harus sebelum "sampai".',
    // ---- server error messages ----
    'Head Coach access required.': 'Butuh akses Head Coach.', 'Admin access required.': 'Butuh akses Admin.',
    'Not available for external coaches.': 'Tidak tersedia untuk coach eksternal.', 'This is not your class.': 'Bukan kelas Anda.',
    'This is not your booking.': 'Bukan booking Anda.', 'Class not found.': 'Kelas tidak ditemukan.',
    'Schedule not found.': 'Jadwal tidak ditemukan.', 'Menu not found.': 'Menu tidak ditemukan.',
    'Invalid role.': 'Role tidak valid.', 'Name is required.': 'Nama wajib diisi.',
    'Incorrect username or password.': 'Username atau password salah.', 'Please select a coach.': 'Coach wajib dipilih.',
    'This booking has not been assigned to a coach.': 'Booking belum di-assign ke coach.', 'Location is required.': 'Lokasi wajib diisi.',
    'Only the author or a Head Coach can delete this.': 'Hanya pembuat atau Head Coach yang bisa menghapus.',
    'Only the author or a Head Coach can edit this.': 'Hanya pembuat atau Head Coach yang bisa mengedit.',
    'Invalid phone number.': 'Nomor HP tidak valid.', 'No booking found for this phone number.': 'Booking dengan nomor HP ini tidak ditemukan.',
    'Phone number or booking code is required.': 'Nomor HP atau kode booking wajib diisi.', 'Class booking code not found.': 'Kode booking kelas tidak ditemukan.',
    'Booking code & rating (1-5) are required.': 'Kode booking & rating (1-5) wajib diisi.', 'This booking code has already submitted a review.': 'Kode booking ini sudah pernah memberi review.',
    'Reviews can only be viewed by Admin & Head Coach.': 'Review hanya bisa dilihat Admin & Head Coach.', 'Invalid attendance data.': 'Data absensi tidak valid.',
    'Please select a coverage coach.': 'Pilih coach coverage.', 'Coverage request not found.': 'Permintaan coverage tidak ditemukan.',
    'Only the coverage coach can approve/reject this.': 'Hanya coach coverage yang dapat menyetujui/menolak.',
    'Select a class & write at least one feedback.': 'Pilih kelas & isi minimal satu feedback.', 'Write at least one feedback.': 'Isi minimal satu feedback.',
    'Template text is required.': 'Teks template wajib diisi.', 'Current & new password are required.': 'Password lama & baru wajib diisi.',
    'New password must be at least 6 characters.': 'Password baru minimal 6 karakter.', 'Current password is incorrect.': 'Password lama salah.',
    'Invalid session. Please log in again.': 'Sesi tidak valid. Silakan login ulang.', 'Endpoint not found.': 'Endpoint tidak ditemukan.',
    'A server error occurred.': 'Terjadi kesalahan di server.',
    'No completed classes for this phone number yet. Reviews can be submitted after a class is finished.': 'Belum ada kelas yang selesai untuk nomor HP ini. Review bisa diberikan setelah kelas selesai.',
  };

  // Whole-word date replacements — applied only to text that contains a digit
  // (so date/label strings localize but free-text content is left alone).
  var W = function (en, id) { return [new RegExp('\\b' + en + '\\b', 'g'), id]; };
  var dateRepl = [
    W('January', 'Januari'), W('February', 'Februari'), W('March', 'Maret'), W('April', 'April'),
    W('June', 'Juni'), W('July', 'Juli'), W('August', 'Agustus'), W('September', 'September'),
    W('October', 'Oktober'), W('November', 'November'), W('December', 'Desember'), W('May', 'Mei'),
    W('Sunday', 'Minggu'), W('Monday', 'Senin'), W('Tuesday', 'Selasa'), W('Wednesday', 'Rabu'),
    W('Thursday', 'Kamis'), W('Friday', 'Jumat'), W('Saturday', 'Sabtu'),
    W('Sun', 'Min'), W('Mon', 'Sen'), W('Tue', 'Sel'), W('Wed', 'Rab'), W('Thu', 'Kam'), W('Fri', 'Jum'), W('Sat', 'Sab'),
    W('Aug', 'Agu'), W('Oct', 'Okt'), W('Dec', 'Des'),
    // uppercase abbreviations used in the schedule heading labels (e.g. "WED 2 JUL")
    W('SUN', 'MIN'), W('MON', 'SEN'), W('TUE', 'SEL'), W('WED', 'RAB'), W('THU', 'KAM'), W('FRI', 'JUM'), W('SAT', 'SAB'),
    W('MAY', 'MEI'), W('AUG', 'AGU'), W('OCT', 'OKT'), W('DEC', 'DES'),
    [/\bSCHEDULE\b/g, 'JADWAL'], [/Schedule All Coach/g, 'Jadwal Semua Coach'],
    [/upcoming classes/g, 'kelas mendatang'], [/classes today/g, 'kelas hari ini'], [/class today/g, 'kelas hari ini'],
    [/ cls\b/g, ' kls'], [/\bUPCOMING\b/g, 'MENDATANG'],
  ];

  // Toast prefixes/phrases (concatenated with dynamic values).
  var toastRepl = [
    ['Coverage request sent to ', 'Permintaan coverage dikirim ke '],
    ['Feedback sent to ', 'Feedback dikirim ke '],
    ['Coach added · user: ', 'Coach ditambahkan · user: '],
    ['Password reset: ', 'Password direset: '],
    ['Status of ', 'Status '], [' updated', ' diperbarui'], [' participants', ' peserta'],
  ];

  return { dict: dict, dateRepl: dateRepl, toastRepl: toastRepl };
})();
