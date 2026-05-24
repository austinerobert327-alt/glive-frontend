import { initializeApp } from "firebase/app";
import {
    browserLocalPersistence,
    getAuth,
    setPersistence
} from "firebase/auth";
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

export const auth = getAuth(app);
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence)
    .catch((error) => {
        console.error("Unable to initialize Firebase auth persistence:", error);
    });

export const db = getFirestore(app);
