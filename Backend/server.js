const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Koneksi ke MySQL XAMPP
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      
    password: '',      
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

// =========================================================
// ENDPOINT AUTENTIKASI (LOGIN & REGISTER)
// =========================================================

// 1. ENDPOINT DAFTAR
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username dan password wajib diisi!' });

    const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
    db.query(query, [username, password], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ message: 'Username sudah digunakan!' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Pendaftaran berhasil! Silakan login.' });
    });
});

// 2. ENDPOINT LOGIN
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    
    db.query(query, [username, password], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ message: 'Username atau password salah!' });
        
        res.json({ message: 'Login berhasil!', user: { id: results[0].id, username: results[0].username } });
    });
});

// =========================================================
// ROUTING / ENDPOINT API UTAMA APLIKASI
// =========================================================

app.get('/api/tasks/history', (req, res) => {
    const query = `
        SELECT tasks.*, history_logs.id AS log_id, history_logs.created_at AS completed_at 
        FROM tasks 
        INNER JOIN history_logs ON tasks.id = history_logs.target_id 
        WHERE tasks.is_completed = 1 AND history_logs.action_type = 'TASK_COMPLETE'
        ORDER BY history_logs.id DESC`;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Undo tugas spesifik berdasarkan task ID dan log ID
app.post('/api/history/undo-by-id', (req, res) => {
    const { taskId, logId } = req.body;
    if (!taskId || !logId) return res.status(400).json({ message: 'taskId dan logId wajib diisi!' });

    db.query('UPDATE tasks SET is_completed = 0 WHERE id = ?', [taskId], (taskErr) => {
        if (taskErr) return res.status(500).json({ error: taskErr.message });
        db.query('DELETE FROM history_logs WHERE id = ?', [logId], (popErr) => {
            if (popErr) return res.status(500).json({ error: popErr.message });
            res.json({ message: 'Tugas berhasil dikembalikan ke daftar aktif!' });
        });
    });
});

app.post('/api/tasks', (req, res) => {
    const { title, priority, category_id } = req.body;
    const query = 'INSERT INTO tasks (title, priority, category_id) VALUES (?, ?, ?)';
    db.query(query, [title, priority, category_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Tugas berhasil ditambahkan!', taskId: result.insertId });
    });
});

app.get('/api/tasks', (req, res) => {
    const query = 'SELECT * FROM tasks WHERE is_completed = 0 ORDER BY priority DESC, created_at ASC';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.put('/api/tasks/:id/complete', (req, res) => {
    const taskId = req.params.id;
    const queryUpdate = 'UPDATE tasks SET is_completed = 1 WHERE id = ?';
    db.query(queryUpdate, [taskId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        const queryLog = 'INSERT INTO history_logs (action_type, target_id) VALUES (?, ?)';
        db.query(queryLog, ['TASK_COMPLETE', taskId], (logErr) => {
            if (logErr) console.error(logErr);
            res.json({ message: 'Tugas berhasil diselesaikan!' });
        });
    });
});

app.post('/api/categories', (req, res) => {
    const { name, parent_id } = req.body;
    const query = 'INSERT INTO categories (name, parent_id) VALUES (?, ?)';
    db.query(query, [name, parent_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Kategori berhasil ditambahkan!' });
    });
});

app.get('/api/categories', (req, res) => {
    const query = 'SELECT * FROM categories';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/habits', (req, res) => {
    const query = 'SELECT * FROM habits';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.put('/api/habits/:id/checkin', (req, res) => {
    const habitId = req.params.id;
    const queryCheck = 'SELECT last_check_in FROM habits WHERE id = ?';
    db.query(queryCheck, [habitId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Habit tidak ditemukan' });

        const lastCheckIn = results[0].last_check_in;
        if (lastCheckIn) {
            const terakhirCheckIn = new Date(lastCheckIn).toISOString().split('T')[0];
            const hariIni = new Date().toISOString().split('T')[0];
            if (terakhirCheckIn === hariIni) {
                return res.status(400).json({ message: 'Kamu sudah melakukan check-in hari ini! 🔥' });
            }
        }

        const queryUpdate = 'UPDATE habits SET streak_count = streak_count + 1, last_check_in = NOW() WHERE id = ?';
        db.query(queryUpdate, [habitId], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });
            res.json({ message: 'Streak berhasil ditambahkan! 🔥' });
        });
    });
});

app.get('/api/history/top', (req, res) => {
    const query = 'SELECT * FROM history_logs ORDER BY id DESC LIMIT 1';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0] || null);
    });
});

app.post('/api/history/undo', (req, res) => {
    const queryGetTop = 'SELECT * FROM history_logs ORDER BY id DESC LIMIT 1';
    db.query(queryGetTop, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(400).json({ message: 'Tidak ada aksi undo!' });

        const topLog = results[0];
        db.query('UPDATE tasks SET is_completed = 0 WHERE id = ?', [topLog.target_id], (taskErr) => {
            if (taskErr) return res.status(500).json({ error: taskErr.message });
            db.query('DELETE FROM history_logs WHERE id = ?', [topLog.id], (popErr) => {
                if (popErr) return res.status(500).json({ error: popErr.message });
                res.json({ message: 'Undo berhasil!' });
            });
        });
    });
});

app.put('/api/tasks/:id', (req, res) => {
    const { title, priority, category_id } = req.body;
    db.query('UPDATE tasks SET title = ?, priority = ?, category_id = ? WHERE id = ?', [title, priority, category_id, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Tugas diperbarui!' });
    });
});

app.delete('/api/tasks/:id', (req, res) => {
    db.query('DELETE FROM tasks WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Tugas dihapus!' });
    });
});

app.post('/api/habits', (req, res) => {
    const { name } = req.body;
    db.query('INSERT INTO habits (name, streak_count) VALUES (?, 0)', [name], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Habit berhasil ditambahkan!' });
    });
});

app.put('/api/habits/:id', (req, res) => {
    db.query('UPDATE habits SET name = ? WHERE id = ?', [req.body.name, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Habit diperbarui!' });
    });
});

app.delete('/api/habits/:id', (req, res) => {
    db.query('DELETE FROM habits WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Habit dihapus!' });
    });
});

app.listen(5000, () => {
    console.log('Server berjalan di port 5000');
});