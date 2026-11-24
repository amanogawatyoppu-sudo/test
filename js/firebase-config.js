// ===== Firebase の設定（Firebase コンソールからコピーして貼り付ける） =====
// 手順は docs/firebase-setup.md を参照。
// ここに書く値は「どのFirebaseプロジェクトにつなぐか」を示す住所のようなもので、
// 秘密の鍵ではない（公開しても大丈夫。守りは firestore.rules が担当する）。
//
// apiKey が空のままだと、クラウドセーブは動かず、ゲームは今までどおり端末保存だけで動く。
export const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
};
