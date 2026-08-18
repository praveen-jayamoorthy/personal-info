// firebase.ts
import { Platform } from "react-native";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  initializeAuth,
  setPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  type Auth,
  // @ts-ignore - getReactNativePersistence exists at runtime but may be missing from RN types
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyAgqDfO7HClixY9lKBIHE-lbUOMO9Swaxo",
  authDomain: "finance-calculator-1993.firebaseapp.com",
  projectId: "finance-calculator-1993",
  storageBucket: "finance-calculator-1993.firebasestorage.app",
  messagingSenderId: "506360410195",
  appId: "1:506360410195:web:a0c68f9f9fd7fe202a16a6",
  measurementId: "G-H82ETNFW1L",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

let auth: Auth;

if (Platform.OS === "web") {
  auth = getAuth(app);
  (async () => {
    try {
      await setPersistence(auth, browserSessionPersistence);
    } catch (err) {
      console.warn(
        "Firebase auth browser session persistence failed, falling back to in-memory persistence",
        err,
      );
      await setPersistence(auth, inMemoryPersistence);
    }
  })();
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export { auth };