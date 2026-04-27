const API_URL = "https://cha-t.tama-kg-6.workers.dev"; 
let currentUser = JSON.parse(localStorage.getItem('chaT_user')) || null;
let currentChannelId = "general";
let lastMsgCounts = {}; // 各チャンネルの既知のメッセージ数を保存
let unreadChannels = new Set(); 

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
    const endpoint = isSignUp ? "/register" : "/login";
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
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
                const audio = document.getElementById('notification-sound');
                audio.play().then(()=>audio.pause()).catch(()=>{}); 
                showApp(); 
            }
        } else { alert(data.error); }
    } catch (e) { alert("通信エラー"); }
}

function showApp() {
    document.getElementById('auth-overlay').style.display = "none";
    document.getElementById('app').style.display = "flex";
    document.getElementById('user-display-name').textContent = currentUser.display_name;
    if ("Notification" in window) Notification.requestPermission();
    loadUserList();
    // 全チャンネルの初期カウントを取得しにいく
    checkAllUnread();
    if(!window.chatInterval) window.chatInterval = setInterval(checkAllUnread, 3000);
}

// 全ての更新をチェックする
async function checkAllUnread() {
    // 1. 現在のチャンネルを更新
    await loadMessages(currentChannelId);
    
    // 2. 他のチャンネル/DMの未読をチェック（簡易化のため主要なもののみ）
    // 実際にはサイドバーにあるIDすべてをループしてチェックするのが理想
    const sidebarItems = document.querySelectorAll('#sidebar li[data-id]');
    sidebarItems.forEach(item => {
        const id = item.getAttribute('data-id');
        if (id !== currentChannelId) checkUnreadFor(id);
    });
}

async function checkUnreadFor(channelId) {
    try {
        const res = await fetch(`${API_URL}/messages?channel=${channelId}`);
        const data = await res.json();
        if (lastMsgCounts[channelId] !== undefined && data.length > lastMsgCounts[channelId]) {
            unreadChannels.add(channelId);
            renderBadges();
        }
        lastMsgCounts[channelId] = data.length;
    } catch (e) {}
}

async function loadMessages(channelId) {
    try {
        const res = await fetch(`${API_URL}/messages?channel=${channelId}`);
        const data = await res.json();
        const msgDiv = document.getElementById('messages');
        
        if (lastMsgCounts[channelId] !== undefined && data.length > lastMsgCounts[channelId]) {
            const newMsg = data[data.length - 1];
            if (newMsg.sender_id !== currentUser.user_id) {
                document.getElementById('notification-sound').play().catch(()=>{});
                if (Notification.permission === "granted") {
                    new Notification(`chaT: ${newMsg.display_name}`, { body: newMsg.content });
                }
            }
        }
        lastMsgCounts[channelId] = data.length;

        if (channelId === currentChannelId) {
            const isBottom = msgDiv.scrollHeight - msgDiv.scrollTop <= msgDiv.clientHeight + 100;
            msgDiv.innerHTML = data.map(m => `
                <div class="msg-item">
                    <div class="msg-user">${m.display_name || m.sender_id}</div>
                    <div class="msg-content">${m.content}</div>
                </div>
            `).join('');
            if(isBottom) msgDiv.scrollTop = msgDiv.scrollHeight;
        }
    } catch (e) {}
}

function renderBadges() {
    document.querySelectorAll('#sidebar li[data-id]').forEach(li => {
        const id = li.getAttribute('data-id');
        let badge = li.querySelector('.unread-badge');
        if (unreadChannels.has(id)) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'unread-badge';
                li.appendChild(badge);
            }
        } else if (badge) {
            badge.remove();
        }
    });
}

function selectChannel(id) {
    currentChannelId = id;
    unreadChannels.delete(id);
    renderBadges();
    const isAnnounce = (id === 'announcement');
    updateHeader(isAnnounce ? "📢 お知らせ" : `# ${id}`, isAnnounce);
    if(window.innerWidth <= 768) toggleSidebar();
    loadMessages(id);
}

async function loadUserList() {
    const res = await fetch(`${API_URL}/users`);
    const users = await res.json();
    const userListDiv = document.getElementById('user-list');
    userListDiv.innerHTML = users
        .filter(u => u.user_id !== currentUser.user_id)
        .map(u => {
            const dmId = `dm_${[currentUser.user_id, u.user_id].sort().join('_')}`;
            return `<li onclick="selectChannel('${dmId}')" data-id="${dmId}">👤 ${u.display_name}</li>`;
        }).join('');
}

function updateHeader(title, isAnnounce) {
    document.getElementById('display-channel-name').textContent = title;
    const container = document.getElementById('chat-container');
    const inputArea = document.getElementById('input-area');
    if (isAnnounce) {
        container.classList.add('mode-announcement');
        inputArea.style.display = (currentUser.user_id === 'admin') ? 'flex' : 'none';
    } else {
        container.classList.remove('mode-announcement');
        inputArea.style.display = 'flex';
    }
}

document.getElementById('message-input').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        const content = e.target.value;
        e.target.value = "";
        await fetch(`${API_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: currentChannelId, sender_id: currentUser.user_id, content: content })
        });
        loadMessages(currentChannelId);
    }
});

function logout() { localStorage.removeItem('chaT_user'); location.reload(); }
window.onload = () => { if (currentUser) showApp(); };
