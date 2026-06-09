const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Koneksi ke MySQL XAMPP
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Default XAMPP
    password: '',      // Default XAMPP dikosongkan
    database: 'myhabit'
});

db.connect((err) => {
    if (err) {
        console.error('Database XAMPP gagal konek:', err);
    } else {
        console.log('Koneksi ke MySQL XAMPP Berhasil!');
    }
});

// Base Endpoint
app.get('/', (req, res) => {
    res.send('Backend MyHabit Ready!');
});

// ROUTING / ENDPOINT API 
// ENDPOINT TAMBAH TUGAS (Insert ke Database)
app.post('/api/tasks', (req, res) => {
    const { title, priority, category_id } = req.body;
    const query = 'INSERT INTO tasks (title, priority, category_id) VALUES (?, ?, ?)';
    
    db.query(query, [title, priority, category_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Tugas berhasil ditambahkan!', taskId: result.insertId });
    });
});

// ENDPOINT LIHAT TUGAS (Logika Priority Queue - Urut dari Prioritas 5 ke 1)
app.get('/api/tasks', (req, res) => {
    // Tugas yang BELUM selesai (is_completed = 0) diurutkan berdasarkan prioritas tertinggi (DESC)
    const query = 'SELECT * FROM tasks WHERE is_completed = 0 ORDER BY priority DESC, created_at ASC';
    
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ENDPOINT SELESAIKAN TUGAS (Ubah status & catat ke riwayat log)
app.put('/api/tasks/:id/complete', (req, res) => {
    const taskId = req.params.id;

    // Update status tugas menjadi selesai (1)
    const queryUpdate = 'UPDATE tasks SET is_completed = 1 WHERE id = ?';
    
    db.query(queryUpdate, [taskId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        // Catat log aksi ke history_logs untuk kebutuhan Stack (Undo) nanti
        const queryLog = 'INSERT INTO history_logs (action_type, target_id) VALUES (?, ?)';
        db.query(queryLog, ['TASK_COMPLETE', taskId], (logErr) => {
            if (logErr) console.error('Gagal mencatat log riwayat:', logErr);
            
            res.json({ message: 'Tugas berhasil diselesaikan!' });
        });
    });
});

// ENDPOINT TAMBAH KATEGORI ATAU SUB-KATEGORI (Tree Node)
app.post('/api/categories', (req, res) => {
    const { name, parent_id } = req.body; // parent_id bisa NULL jika ini adalah Root Category
    const query = 'INSERT INTO categories (name, parent_id) VALUES (?, ?)';
    
    db.query(query, [name, parent_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Kategori/Node berhasil ditambahkan!' });
    });
});

// ENDPOINT AMBIL SEMUA KATEGORI (Untuk Tree View Frontend)
app.get('/api/categories', (req, res) => {
    const query = 'SELECT * FROM categories';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Habit Tracker Endpoints

// ENDPOINT AMBIL SEMUA HABIT
app.get('/api/habits', (req, res) => {
    const query = 'SELECT * FROM habits';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// ENDPOINT CHECK-IN HABIT (Menambah Streak Count)
app.put('/api/habits/:id/checkin', (req, res) => {
    const habitId = req.params.id;
    // Query untuk menaikkan streak +1 dan mengupdate waktu check-in terakhir ke waktu sekarang
    const query = 'UPDATE habits SET streak_count = streak_count + 1, last_check_in = NOW() WHERE id = ?';
    
    db.query(query, [habitId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Streak berhasil ditambahkan! 🔥' });
    });
});

// Stack History Log Endpoints 

// ENDPOINT LIHAT LOG TERAKHIR (Top of Stack)
app.get('/api/history/top', (req, res) => {
    // Ambil 1 data terakhir yang dimasukkan ke tabel log (Prinsip LIFO Stack)
    const query = 'SELECT * FROM history_logs ORDER BY id DESC LIMIT 1';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0] || null); // Kirim log teratas atau null jika kosong
    });
});

// ENDPOINT UNDO AKSES (Pop dari Stack & Kembalikan Status Tugas di DB)
app.post('/api/history/undo', (req, res) => {
    // Cari log paling atas dulu
    const queryGetTop = 'SELECT * FROM history_logs ORDER BY id DESC LIMIT 1';
    
    db.query(queryGetTop, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(400).json({ message: 'Tidak ada aksi yang bisa di-undo!' });

        const topLog = results[0];
        const logId = topLog.id;
        const taskId = topLog.target_id;

        // Kembalikan tugas menjadi belum selesai (is_completed = 0)
        const queryRollbackTask = 'UPDATE tasks SET is_completed = 0 WHERE id = ?';
        db.query(queryRollbackTask, [taskId], (taskErr) => {
            if (taskErr) return res.status(500).json({ error: taskErr.message });

            // Hapus log teratas tersebut dari database (Proses POP dari Stack)
            const queryPopStack = 'DELETE FROM history_logs WHERE id = ?';
            db.query(queryPopStack, [logId], (popErr) => {
                if (popErr) return res.status(500).json({ error: popErr.message });
                
                res.json({ message: 'Undo berhasil! Tugas dikembalikan ke daftar aktif.' });
            });
        });
    });
});

// JALANKAN SERVER 
app.listen(5000, () => {
    console.log('Server berjalan di port 5000');
});