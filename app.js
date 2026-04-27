const API_URL = "https://cha-t.tama-kg-6.workers.dev/s"; 

// メッセージ入力欄のエンターキーを監視
document.getElementById('message-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content) return;

    // 画面にすぐ表示（仮）
    appendMessage("あなた", content);
    input.value = "";

    // 本来はここで Workers 経由で D1 に保存する fetch を送ります
    /*
    await fetch(`${API_URL}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: content, channel_id: currentChannelId })
    });
    */
}

function appendMessage(user, text) {
    const msgDiv = document.getElementById('messages');
    const newMsg = document.createElement('div');
    newMsg.style.marginBottom = "15px";
    newMsg.innerHTML = `
        <strong style="color: #4a90e2;">${user}</strong>
        <div style="background: #f8f9fa; padding: 10px; border-radius: 0 15px 15px 15px; margin-top: 5px; display: inline-block; border: 1px solid #eee;">
            ${text}
        </div>
    `;
    msgDiv.appendChild(newMsg);
    msgDiv.scrollTop = msgDiv.scrollHeight; // 自動スクロール
}
