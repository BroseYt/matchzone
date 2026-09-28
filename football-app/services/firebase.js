import {
  initializeApp,
  getApps,
  getApp,
} from "firebase/app";

import {
  initializeAuth,
  getAuth,
} from "firebase/auth";

import {
  getFirestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBBFeh-B4vkNTBzHOfx-IDTPYcliS_Jk2E",
  authDomain: "football-app-4c533.firebaseapp.com",
  projectId: "football-app-4c533",
  storageBucket: "football-app-4c533.firebasestorage.app",
  messagingSenderId: "939557304457",
  appId: "1:939557304457:web:d4702c8f8330875d322e58",
};

const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();

let auth;

try {
  auth = initializeAuth(app);
} catch (error) {
  auth = getAuth(app);
}

const db = getFirestore(app);

export {
  auth,
  db,
};

export default app;
