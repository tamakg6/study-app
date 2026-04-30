const API_URL = "https://cha-t.tama-kg-6.workers.dev";
let currentUser = JSON.parse(localStorage.getItem('chaT_user')) || null;
let currentChannelId = "general";
let lastMsgCounts = {}; 
let isSignUp = false;
let contacts = currentUser ? (JSON.parse(localStorage.getItem(`chaT_contacts_${currentUser.user_id}`)) || []) : [];

function toggleSidebar() { document.getElementById('app').classList.toggle('sidebar-open'); }

function toggleAuthMode() {
    isSignUp = !isSignUp;
    document.getElementById('auth-title').textContent = isSignUp ? "chaT に新規登録" : "chaT にログイン";
    document.getElementById('auth-btn').textContent = isSignUp ? "登録する" : "はじめる";
    document.getElementById('auth-displayname').style.display = isSignUp ? "block" : "none";
}

async function handleAuth() {
    const user_id = document.getElementById('auth-userid').value;
    const password = document.getElementById('auth-password').value;
    const display_name = document.getElementById('auth-displayname').value;
    if(!user_id || !password) return alert("入力してください");
    try {
        const res = await fetch(`${API_URL}${isSignUp ? "/register" : "/login"}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id, password, display_name })
        });
        const data = await res.json();
        if (res.ok) {
            if (isSignUp) { alert("完了！ログインしてください"); toggleAuthMode(); }
            else { 
                currentUser = data.user; 
                localStorage.setItem('chaT_user', JSON.stringify(currentUser)); 
                contacts = JSON.parse(localStorage.getItem(`chaT_contacts_${currentUser.user_id}`)) || [];
                showApp(); 
            }
        } else { alert(data.error); }
    } catch (e) { alert("通信エラー"); }
}

function showApp() {
    document.getElementById('auth-overlay').style.display = "none";
    document.getElementById('app').style.display = "flex";
    document.getElementById('user-display-name').textContent = currentUser.display_name;

    // adminなら管理メニューを表示
    if(currentUser.user_id === 'admin') {
        document.getElementById('admin-menu').style.display = 'block';
    }

    renderUserList();
    setInterval(updatePolling, 3000);
    selectChannel('general');

    const tx = document.getElementById('message-input');
    tx.addEventListener('input', () => {
        tx.style.height = 'auto';
        tx.style.height = tx.scrollHeight + 'px';
    });
}

// メンテナンスチェック (APIから503エラーが返ってきたら表示)
function checkMaintenance(status) {
    if (status === 503 && currentUser?.user_id !== 'admin') {
        document.getElementById('maintenance-overlay').style.display = 'flex';
        return true;
    }
    document.getElementById('maintenance-overlay').style.display = 'none';
    return false;
}

// メンテナンス切替 (admin専用)
async function toggleMaintenanceMode() {
    // ボタンを押したときに選択肢を出す
    const choice = confirm("メンテナンスを【開始】しますか？\n（[キャンセル] を押すとメンテナンスを【解除】します）");
    const val = choice ? "true" : "false"; // OKなら開始、キャンセルなら解除

    try {
        const res = await fetch(`${API_URL}/admin/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                key: 'maintenance_mode', 
                value: val, 
                user_id: currentUser.user_id 
            })
        });
        
        if(res.ok) {
            alert(`メンテナンスを ${val === "true" ? 'ON' : 'OFF'} にしました。`);
            location.reload(); // 状態を自分にも反映させる
        }
    } catch(e) {
        alert("Workersとの通信に失敗しました。");
    }
}

async function addContact() {
    const targetId = document.getElementById('search-userid').value.trim();
    if (!targetId || targetId === currentUser.user_id) return;
    if (contacts.find(c => c.user_id === targetId)) return alert("すでに追加されています");

    try {
        const res = await fetch(`${API_URL}/users`);
        const users = await res.json();
        const found = users.find(u => u.user_id === targetId);
        if (found) {
            contacts.push({ user_id: found.user_id, display_name: found.display_name });
            localStorage.setItem(`chaT_contacts_${currentUser.user_id}`, JSON.stringify(contacts));
            renderUserList();
            document.getElementById('search-userid').value = "";
        } else { alert("ユーザーが見つかりません"); }
    } catch (e) {}
}

function renderUserList() {
    const list = document.getElementById('user-list');
    list.innerHTML = contacts.map(u => {
        const dmId = `dm_${[currentUser.user_id, u.user_id].sort().join('_')}`;
        return `<li onclick="selectChannel('${dmId}')" data-id="${dmId}">👤 ${u.display_name}</li>`;
    }).join('');
}

async function updatePolling() {
    await loadMessages(currentChannelId);
}

async function loadMessages(channelId) {
    try {
        const res = await fetch(`${API_URL}/messages?channel=${channelId}`);
        if (checkMaintenance(res.status)) return;
        
        const data = await res.json();
        const msgDiv = document.getElementById('messages');
        
        if (channelId === currentChannelId) {
            const isBottom = msgDiv.scrollHeight - msgDiv.scrollTop <= msgDiv.clientHeight + 100;
            msgDiv.innerHTML = data.map(m => {
                const date = new Date(m.created_at);
                const timeStr = isNaN(date.getTime()) ? "" : `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                // 自分の発言かadminなら削除ボタン表示
                const delBtn = (m.sender_id === currentUser.user_id || currentUser.user_id === 'admin') 
                    ? `<span class="delete-btn" onclick="deleteMessage(${m.id})">×</span>` : "";

                return `
                    <div class="msg-item">
                        <div class="msg-header">
                            <span class="msg-user">${m.display_name || m.sender_id}</span>
                            ${delBtn}
                        </div>
                        <div class="msg-content">
                            ${m.content}
                            <div class="msg-footer">${timeStr}</div>
                        </div>
                    </div>
                `;
            }).join('');
            if(isBottom) msgDiv.scrollTop = msgDiv.scrollHeight;
        }
    } catch (e) {}
}

async function deleteMessage(id) {
    if(!confirm("削除しますか？")) return;
    // Workers側の削除API(DELETE)が必要です
    alert("Workers側に削除処理(DELETE)を追加後、実際に削除可能になります。今はSQLで消してください。");
}

function selectChannel(id) {
    currentChannelId = id;
    const isAnnounce = (id === 'announcement');
    document.getElementById('display-channel-name').textContent = isAnnounce ? "📢 お知らせ" : `# ${id}`;
    document.getElementById('input-area').style.display = (isAnnounce && currentUser.user_id !== 'admin') ? 'none' : 'flex';
    if(window.innerWidth <= 768) document.getElementById('app').classList.remove('sidebar-open');
    loadMessages(id);
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;
    input.value = "";
    input.style.height = 'auto';
    const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: currentChannelId, sender_id: currentUser.user_id, content: content })
    });
    if (checkMaintenance(res.status)) return;
    loadMessages(currentChannelId);
}

function logout() { localStorage.removeItem('chaT_user'); location.reload(); }
window.onload = () => { if (currentUser) showApp(); };
