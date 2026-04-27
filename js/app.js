// 1. Firebase SDKの読み込み（CDN経由）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    orderBy, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. Firebaseの設定（あなたのConfigをここに貼り付け）
const firebaseConfig = {
    apiKey: "AIzaSyAZZ4DTGI3NBkgVs3HzfAg6aVWv-JT9bIM",
    authDomain: "study-time-9548e.firebaseapp.com",
    projectId: "study-time-9548e",
    storageBucket: "study-time-9548e.firebasestorage.app",
    messagingSenderId: "1067722642794",
    appId: "1:1067722642794:web:9337121e9abcd408614113",
    measurementId: "G-Z7Z0TZ1QRT"
};

// 3. Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 4. HTML要素の取得
const saveBtn = document.getElementById('save-btn');
const subjectInput = document.getElementById('subject');
const minutesInput = document.getElementById('minutes');
const logList = document.getElementById('log-list');

// 5. 【保存機能】ボタンクリック時にFirestoreへデータを送る
saveBtn.addEventListener('click', async () => {
    const subject = subjectInput.value;
    const minutes = Number(minutesInput.value);

    // バリデーション（空入力を防ぐ）
    if (!subject || !minutes) {
        alert("学習内容と時間を入力してください！");
        return;
    }

    try {
        // Firestoreの "logs" コレクションにデータを追加
        await addDoc(collection(db, "logs"), {
            subject: subject,
            minutes: minutes,
            createdAt: serverTimestamp() // サーバー側の日時を使用
        });

        // 入力欄をリセット
        subjectInput.value = "";
        minutesInput.value = "";
        
        console.log("保存成功！");
    } catch (error) {
        console.error("保存エラー:", error);
        alert("データの保存に失敗しました。コンソールを確認してください。");
    }
});

// 6. 【取得・表示機能】データが更新されたら自動で画面を書き換える
// "logs" コレクションを、作成日時の降順（新しい順）で並び替え
const q = query(collection(db, "logs"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
    // リストを一旦空にする
    logList.innerHTML = "";

    snapshot.forEach((doc) => {
        const data = doc.data();
        
        // 日時のフォーマット（createdAtが取得できるまでラグがあるためチェック）
        const timeLabel = data.createdAt ? data.createdAt.toDate().toLocaleString('ja-JP') : "保存中...";

        // HTML要素を作成して追加
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${data.subject}</strong>
                <small style="display: block; color: #666;">${timeLabel}</small>
            </div>
            <span class="minutes-badge">${data.minutes} 分</span>
        `;
        logList.appendChild(li);
    });
});s
