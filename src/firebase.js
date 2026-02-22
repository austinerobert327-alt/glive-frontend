import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCTFbMmhafuS0nK2TJwhU7YfiuQK9sue_Y",
    authDomain: "glive-platform.firebaseapp.com",
    projectId: "glive-platform",
    storageBucket: "glive-platform.firebasestorage.app",
    messagingSenderId: "388407603099",
    appId: "1:388407603099:web:fa994dcadc83bae89efb3e"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
