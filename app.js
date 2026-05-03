const API_URL = "https://cha-t.tama-kg-6.workers.dev";
let currentUser = JSON.parse(localStorage.getItem('chaT_user')) || null;
let currentChannelId = "general";
let lastRenderedKey = {};  // チャンネルごとに最後に描画したデータのキャッシュ
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

    // ユーザーID表示（user-name-blockがあれば@IDも表示）
    const useridLabel = document.getElementById('user-userid-label');
    if (useridLabel) useridLabel.textContent = `@${currentUser.user_id}`;

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

    // Enterで送信、Shift+Enterで改行
    tx.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

function checkMaintenance(status) {
    if (status === 503 && currentUser?.user_id !== 'admin') {
        document.getElementById('maintenance-overlay').style.display = 'flex';
        return true;
    }
    document.getElementById('maintenance-overlay').style.display = 'none';
    return false;
}

async function toggleMaintenanceMode() {
    const choice = confirm("メンテナンスを【開始】しますか？\n（[キャンセル] を押すとメンテナンスを【解除】します）");
    const val = choice ? "true" : "false";

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
            location.reload();
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

// アクティブなチャンネルのハイライトを更新
function updateActiveSidebarItem(channelId) {
    document.querySelectorAll('#sidebar li').forEach(el => {
        el.classList.toggle('active', el.dataset.id === channelId);
    });
}

async function updatePolling() {
    await loadMessages(currentChannelId);
}

// D1のUTC文字列 → JSTのDateオブジェクトに変換
function parseJST(str) {
    if (!str) return null;
    // "2025-01-01 12:00:00" → "2025-01-01T12:00:00Z" としてUTC解釈 → JST変換
    const utc = new Date(str.replace(' ', 'T') + 'Z');
    return isNaN(utc.getTime()) ? null : utc;
}

// JST表示用ヘルパー
function formatTime(date) {
    if (!date) return "";
    return date.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
    if (!date) return "";
    return date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function formatDateKey(date) {
    if (!date) return "";
    return date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

async function loadMessages(channelId) {
    try {
        const res = await fetch(`${API_URL}/messages?channel=${channelId}`);
        if (checkMaintenance(res.status)) return;

        const data = await res.json();

        // ★ 点滅防止：前回と内容が同じなら描画をスキップ
        const newKey = JSON.stringify(data.map(m => `${m.id}_${m.content}`));
        if (lastRenderedKey[channelId] === newKey) return;
        lastRenderedKey[channelId] = newKey;

        const msgDiv = document.getElementById('messages');
        if (channelId !== currentChannelId) return;

        const isBottom = msgDiv.scrollHeight - msgDiv.scrollTop <= msgDiv.clientHeight + 100;

        let lastDateKey = null;
        const html = data.map(m => {
            const isMine = m.sender_id === currentUser.user_id;
            const date = parseJST(m.created_at);
            const timeStr = formatTime(date);
            const dateKey = formatDateKey(date);
            const canDelete = isMine || currentUser.user_id === 'admin';
            const delBtn = canDelete ? `<span class="delete-btn" onclick="deleteMessage(${m.id})" title="削除">×</span>` : "";
            const sideClass = isMine ? 'mine' : 'other';
            const headerContent = isMine
                ? delBtn
                : `<span class="msg-user">${m.display_name || m.sender_id}</span>${delBtn}`;

            // ★ 日付が変わったら区切り線を挿入
            let dateSeparator = '';
            if (dateKey && dateKey !== lastDateKey) {
                dateSeparator = `<div class="date-separator"><span>${formatDate(date)}</span></div>`;
                lastDateKey = dateKey;
            }

            return `${dateSeparator}
                <div class="msg-item ${sideClass}">
                    <div class="msg-header">${headerContent}</div>
                    <div class="msg-content">${escapeHtml(m.content)}</div>
                    <div class="msg-footer">${timeStr}</div>
                </div>`;
        }).join('');

        msgDiv.innerHTML = html;
        if (isBottom) msgDiv.scrollTop = msgDiv.scrollHeight;

    } catch (e) {}
}

// XSS対策：HTMLエスケープ
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// メッセージ削除（Workers側のDELETE APIを呼び出す）
async function deleteMessage(id) {
    if (!confirm("削除しますか？")) return;
    try {
        const res = await fetch(`${API_URL}/messages/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.user_id })
        });
        if (res.ok) {
            await loadMessages(currentChannelId);
        } else {
            alert("削除に失敗しました。");
        }
    } catch (e) {
        alert("通信エラーが発生しました。");
    }
}

function selectChannel(id) {
    currentChannelId = id;
    const isAnnounce = (id === 'announcement');
    document.getElementById('display-channel-name').textContent = isAnnounce ? "📢 お知らせ" : `# ${id}`;
    document.getElementById('input-area').style.display = (isAnnounce && currentUser.user_id !== 'admin') ? 'none' : 'flex';
    updateActiveSidebarItem(id);
    if(window.innerWidth <= 768) document.getElementById('app').classList.remove('sidebar-open');
    loadMessages(id);
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    input.value = "";
    input.style.height = 'auto';

    try {
        const res = await fetch(`${API_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                channel_id: currentChannelId, 
                sender_id: currentUser.user_id, 
                content: content 
            })
        });

        if (res.ok) {
            await loadMessages(currentChannelId);
        } else if (res.status === 503) {
            alert("現在メンテナンス中のため送信できません。");
        } else {
            alert("送信に失敗しました。");
        }
    } catch (e) {
        console.error("Error:", e);
        alert("通信エラーが発生しました。");
    }
}

function logout() { localStorage.removeItem('chaT_user'); location.reload(); }
window.onload = () => { if (currentUser) showApp(); };
