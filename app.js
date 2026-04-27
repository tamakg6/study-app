const API_URL = "https://cha-t.tama-kg-6.workers.dev"; // 末尾に / を入れない
let currentUser = JSON.parse(localStorage.getItem('chaT_user')) || null;
let currentChannelId = "general";
let isSignUp = false;

function toggleAuthMode() {
    isSignUp = !isSignUp;
    document.getElementById('auth-title').textContent = isSignUp ? "chaT に新規登録" : "chaT にログイン";
    document.getElementById('auth-btn').textContent = isSignUp ? "登録する" : "ログイン";
    document.getElementById('auth-displayname').style.display = isSignUp ? "block" : "none";
}

async function handleAuth() {
    const user_id = document.getElementById('auth-userid').value;
    const password = document.getElementById('auth-password').value;
    const display_name = document.getElementById('auth-displayname').value;

    if(!user_id || !password) return alert("入力してください");

    const endpoint = isSignUp ? "/register" : "/login";
    const body = isSignUp ? { user_id, password, display_name } : { user_id, password };

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        
        if (res.ok) {
            if (isSignUp) {
                alert("登録完了！ログインしてください。");
                toggleAuthMode();
            } else {
                currentUser = data.user;
                localStorage.setItem('chaT_user', JSON.stringify(currentUser));
                showApp();
            }
        } else {
            alert("サーバーからの回答: " + data.error);
        }
    } catch (e) {
        alert("通信エラーが発生しました。\n理由: " + e.message + "\nURLを確認してください: " + API_URL + endpoint);
    }
}

function showApp() {
    document.getElementById('auth-overlay').style.display = "none";
    document.getElementById('app').style.display = "flex";
    document.getElementById('user-info').textContent = `ログイン中: ${currentUser.display_name}`;
    loadMessages();
    setInterval(loadMessages, 3000);
}

async function loadMessages() {
    try {
        const res = await fetch(`${API_URL}/messages?channel=${currentChannelId}`);
        const data = await res.json();
        const msgDiv = document.getElementById('messages');
        msgDiv.innerHTML = data.map(m => `
            <div class="msg-item">
                <div class="msg-user">${m.sender_id}</div>
                <div class="msg-content">${m.content}</div>
            </div>
        `).join('');
        msgDiv.scrollTop = msgDiv.scrollHeight;
    } catch (e) {
        console.error("メッセージ取得失敗");
    }
}

document.getElementById('message-input').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        const content = e.target.value;
        e.target.value = "";
        try {
            await fetch(`${API_URL}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel_id: currentChannelId,
                    sender_id: currentUser.user_id,
                    content: content
                })
            });
            loadMessages();
        } catch (e) {
            alert("送信に失敗しました");
        }
    }
});

function logout() {
    localStorage.removeItem('chaT_user');
    location.reload();
}

window.onload = () => { if (currentUser) showApp(); };
