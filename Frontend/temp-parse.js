
        const API_URL = 'http://localhost:5000/api';

        // ── LOGIKA MANAJEMEN AUTHENTICATION ──
        function gantiFormAuth(target) {
            if(target === 'register') {
                document.getElementById('login-box').style.display = 'none';
                document.getElementById('register-box').style.display = 'block';
            } else {
                document.getElementById('login-box').style.display = 'block';
                document.getElementById('register-box').style.display = 'none';
            }
        }

        async function prosesRegister() {
            const u = document.getElementById('reg-username').value;
            const p = document.getElementById('reg-password').value;
            if(!u || !p) return alert("Isi form pendaftaran dengan lengkap!");

            try {
                const r = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ username: u, password: p })
                });
                const res = await r.json();
                alert(res.message);
                if(r.ok) gantiFormAuth('login');
            } catch(e) { alert("Pendaftaran akun gagal."); }
        }

        async function prosesLogin() {
            const u = document.getElementById('login-username').value;
            const p = document.getElementById('login-password').value;
            
            try {
                const r = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ username: u, password: p })
                });
                const res = await r.json();
                if(r.ok) {
                    alert("Selamat datang kembali!");
                    document.getElementById('auth-page').style.display = 'none';
                    document.getElementById('main-dashboard').style.display = 'flex';
                    document.getElementById('profile-display-username').innerText = `👤 ${res.user.username}`;
                    refreshSemuaData();
                } else {
                    alert(res.message);
                }
            } catch(e) { alert("Koneksi gagal ke server backend."); }
        }

        function prosesLogout() {
            alert("Sesi kamu berakhir. Sampai jumpa!");
            document.getElementById('login-username').value = '';
            document.getElementById('login-password').value = '';
            document.getElementById('main-dashboard').style.display = 'none';
            document.getElementById('auth-page').style.display = 'flex';
            gantiTab('todo');
        }

        // ── LOGIKA SWITCH VIEW NAVIGATION TAB SIDEBAR ──
        function gantiTab(tabName) {
            document.querySelectorAll('.view-content').forEach(view => view.classList.remove('active-view'));
            document.querySelectorAll('.sidebar-menu a').forEach(btn => btn.classList.remove('active'));

            if(tabName === 'todo') {
                document.getElementById('view-todo').classList.add('active-view');
                document.getElementById('menu-todo').classList.add('active');
            } else if(tabName === 'habit') {
                document.getElementById('view-habit').classList.add('active-view');
                document.getElementById('menu-habit').classList.add('active');
            } else if(tabName === 'profile') {
                document.getElementById('view-profile').classList.add('active-view');
                document.getElementById('menu-profile').classList.add('active');
            }
        }

        // ── CORE LOGIC INTERAKSI DATA DB ──
        async function muatDaftarTugas() {
            const r = await fetch(`${API_URL}/tasks`);
            const tasks = await r.json();
            const box = document.getElementById('task-list-box');
            box.innerHTML = '';
            if(tasks.length === 0) { box.innerHTML = '<p style="color:#718096;">Tidak ada tugas aktif.</p>'; return; }

            tasks.forEach(t => {
                const lbl = t.priority === 3 ? '🔴 Penting' : t.priority === 2 ? '🟡 Sedang' : '🔵 Santai';
                box.innerHTML += `
                    <div class="task-item" style="display:flex; justify-content:space-between; align-items:center; background:#f7fafc; padding:12px; margin-bottom:8px; border-radius:8px; border-left:4px solid ${t.priority===3?'#e53e3e':t.priority===2?'#dd6b20':'#3182ce'}">
                        <div>
                            <strong>${t.title}</strong> <br>
                            <small>${lbl}</small>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button class="btn-action" style="background:#38a169;" onclick="selesaikanTugasAksi(${t.id})">✓ Selesai</button>
                            <button class="btn-action" style="background:#3182ce;" onclick="pemicuEditTugas(${t.id}, '${t.title}', ${t.priority}, '${t.category_id||''}')">✏️</button>
                            <button class="btn-action" style="background:#e53e3e;" onclick="pemicuHapusKustom('task', ${t.id})">🗑️</button>
                        </div>
                    </div>`;
            });
        }

        async function muatRiwayatTugas() {
            const r = await fetch(`${API_URL}/tasks/history`);
            const history = await r.json();
            const box = document.getElementById('task-history-box');
            box.innerHTML = '';
            if(history.length === 0) { box.innerHTML = '<p style="color:#a0aec0;">Belum ada riwayat riil.</p>'; return; }
            history.forEach(h => {
                box.innerHTML += `<div style="background:#edf2f7; padding:10px; margin-bottom:6px; border-radius:6px; font-size:14px;">✅ <strong>${h.title}</strong> - <small>${new Date(h.completed_at).toLocaleTimeString()}</small></div>`;
            });
        }

        async function muatKategoriTree() {
            const r = await fetch(`${API_URL}/categories`);
            const cats = await r.json();
            
            // Isi Dropdown Forms
            const s1 = document.getElementById('taskCategory');
            const s2 = document.getElementById('editTaskCategory');
            const s3 = document.getElementById('parentCategorySelect');
            s1.innerHTML = s2.innerHTML = '<option value="">Tanpa Kategori</option>';
            s3.innerHTML = '<option value="">-- Set Sebagai Root Node Induk --</option>';
            
            cats.forEach(c => {
                s1.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                s2.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                s3.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });

            // Tampilkan Tree
            const treeBox = document.getElementById('category-tree-box');
            treeBox.innerHTML = '';
            const roots = cats.filter(c => !c.parent_id);
            if(roots.length === 0) { treeBox.innerHTML = '<p style="color:#a0aec0;">Belum ada kategori.</p>'; return; }

            roots.forEach(rt => {
                treeBox.innerHTML += `<div class="tree-root"><span class="tree-icon">📁</span> <span class="tree-text">${rt.name}</span></div>`;
                cats.filter(c => c.parent_id === rt.id).forEach(ch => {
                    treeBox.innerHTML += `<div class="tree-child"><span class="tree-line">└─</span><span class="tree-icon">📄</span><span class="tree-text">${ch.name}</span></div>`;
                });
            });
        }

        async function muatHabitTracker() {
            const r = await fetch(`${API_URL}/habits`);
            const habits = await r.json();
            const box = document.getElementById('habit-tracker-box');
            box.innerHTML = '';
            if(habits.length === 0) { box.innerHTML = '<p style="color:#718096;">Belum ada rutinitas ditambahkan.</p>'; return; }

            habits.forEach(h => {
                box.innerHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #e2e8f0; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                        <div><strong>${h.name}</strong> <br> <span style="font-size:13px; color:#e53e3e;">🔥 ${h.streak_count} Hari Beruntun</span></div>
                        <div style="display:flex; gap:6px;">
                            <button class="btn-action" style="background:#e53e3e;" onclick="checkInHabit(${h.id})">🔥 Check-In</button>
                            <button class="btn-action" style="background:#e53e3e;" onclick="pemicuHapusKustom('habit', ${h.id})">🗑️</button>
                        </div>
                    </div>`;
            });
        }

        async function simpanTugasBaru() {
            const title = document.getElementById('taskTitle').value;
            const priority = document.getElementById('taskPriority').value;
            const category_id = document.getElementById('taskCategory').value || null;
            if(!title) return alert("Judul tugas kosong!");

            await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ title, priority, category_id })
            });
            tutupModal('taskModal');
            document.getElementById('taskTitle').value = '';
            refreshSemuaData();
        }

        async function selesaikanTugasAksi(id) {
            await fetch(`${API_URL}/tasks/${id}/complete`, { method: 'PUT' });
            refreshSemuaData();
        }

        async function tambahKategoriNode() {
            const name = document.getElementById('categoryName').value;
            const parent_id = document.getElementById('parentCategorySelect').value || null;
            if(!name) return alert("Nama kategori kosong!");

            await fetch(`${API_URL}/categories`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name, parent_id })
            });
            document.getElementById('categoryName').value = '';
            refreshSemuaData();
        }

        async function tambahHabitBaru() {
            const name = document.getElementById('newHabitName').value;
            if(!name) return alert("Nama habit kosong!");

            await fetch(`${API_URL}/habits`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name })
            });
            document.getElementById('newHabitName').value = '';
            muatHabitTracker();
        }

        async function checkInHabit(id) {
            const r = await fetch(`${API_URL}/habits/${id}/checkin`, { method: 'PUT' });
            const res = await r.json();
            alert(res.message);
            muatHabitTracker();
        }

        function pemicuEditTugas(id, title, priority, catId) {
            document.getElementById('editTaskId').value = id;
            document.getElementById('editTaskTitle').value = title;
            document.getElementById('editTaskPriority').value = priority;
            document.getElementById('editTaskCategory').value = catId;
            document.getElementById('editTaskModal').style.display = 'flex';
        }

        async function eksekusiUpdateTugas() {
            const id = document.getElementById('editTaskId').value;
            const title = document.getElementById('editTaskTitle').value;
            const priority = document.getElementById('editTaskPriority').value;
            const category_id = document.getElementById('editTaskCategory').value || null;

            await fetch(`${API_URL}/tasks/${id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ title, priority, category_id })
            });
            tutupModal('editTaskModal');
            refreshSemuaData();
        }

        function pemicuHapusKustom(type, id) {
            document.getElementById('deleteTargetType').value = type;
            document.getElementById('deleteTargetId').value = id;
            document.getElementById('deleteConfirmModal').style.display = 'flex';
        }

        async function eksekusiHapusData() {
            const type = document.getElementById('deleteTargetType').value;
            const id = document.getElementById('deleteTargetId').value;
            await fetch(`${API_URL}/${type === 'task' ? 'tasks' : 'habits'}/${id}`, { method: 'DELETE' });
            tutupModal('deleteConfirmModal');
            refreshSemuaData();
        }

        async function muatUndoBar() {
            const r = await fetch(`${API_URL}/history/top`);
            const topLog = await r.json();
            const bar = document.getElementById('undo-notification-bar');
            if(topLog) {
                bar.style.display = 'flex';
                document.getElementById('undo-msg-text').innerText = `Tugas diselesaikan pada ${new Date(topLog.created_at).toLocaleTimeString()}`;
            } else { bar.style.display = 'none'; }
        }

        async function eksekusiUndoAksi() {
            await fetch(`${API_URL}/history/undo`, { method: 'POST' });
            refreshSemuaData();
        }

        function refreshSemuaData() {
            muatDaftarTugas();
            muatRiwayatTugas();
            muatKategoriTree();
            muatHabitTracker();
            muatUndoBar();
        }

        function bukaModalTambah() { document.getElementById('taskModal').style.display = 'flex'; }
        function tutupModal(id) { document.getElementById(id).style.display = 'none'; }
    