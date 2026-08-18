// store/authStore.ts
import { create } from "zustand";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

type RegisterProfilePayload = {
  displayName: string;
  email: string;
  photoURL?: string;
};

type AuthState = {
  user: User | null;
  initializing: boolean;
  isRegistered: boolean | null;
  registerUserProfile: (payload: RegisterProfilePayload) => Promise<void>;
  _init: () => () => void; // returns unsubscribe
};

async function checkUserRegistration(uid: string) {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initializing: true,
  isRegistered: null,

  registerUserProfile: async (payload) => {
    const { user } = get();
    if (!user) {
      throw new Error("No authenticated user available.");
    }
    try {
      console.log("Registering user profile for:", user.uid, payload);
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        displayName: payload.displayName,
        email: payload.email,
        photoURL: payload.photoURL || null,
        phoneNumber: user.phoneNumber || null,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });
      console.log("User profile registered successfully for:", user.uid);
      set({ isRegistered: true });
    } catch (error) {
      console.error("Failed to register user profile", error);
    }
  },

  // Sets up the Firebase auth listener. Call this ONCE at app start.
  _init: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      set({ user: firebaseUser });

      if (!firebaseUser) {
        set({ isRegistered: null, initializing: false });
        return;
      }

      try {
        const registered = await checkUserRegistration(firebaseUser.uid);
        set({ isRegistered: registered });
      } catch (error) {
        console.error("Failed to verify registration status", error);
        set({ isRegistered: false });
      } finally {
        set({ initializing: false });
      }
    });

    return unsubscribe;
  },
}));