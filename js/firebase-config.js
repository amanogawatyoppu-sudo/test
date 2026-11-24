// ===== Firebase の設定（Firebase コンソールからコピーして貼り付ける） =====
// 手順は docs/firebase-setup.md を参照。
// ここに書く値は「どのFirebaseプロジェクトにつなぐか」を示す住所のようなもので、
// 秘密の鍵ではない（公開しても大丈夫。守りは firestore.rules が担当する）。
//
// apiKey が空のままだと、クラウドセーブは動かず、ゲームは今までどおり端末保存だけで動く。
export const firebaseConfig = {
    apiKey: "AIzaSyBYBJHT02qeOkHSyB566GNGvc1_XT8S8YU",
    authDomain: "mugen-sobado.firebaseapp.com",
    projectId: "mugen-sobado",
    storageBucket: "mugen-sobado.firebasestorage.app",
    messagingSenderId: "785010971637",
    appId: "1:785010971637:web:511e14999e8bdd980e86bc",
};
