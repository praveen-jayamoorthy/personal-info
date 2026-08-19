// store/authStore.ts
import { create } from "zustand";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

type RegisterProfilePayload = {
  displayName: string;
  email: string;
  photoURL?: string;
};

type AuthState = {
  user: FirebaseAuthTypes.User | null;
  initializing: boolean;
  isRegistered: boolean | null;
  registerUserProfile: (payload: RegisterProfilePayload) => Promise<void>;
  _init: () => () => void; // returns unsubscribe
};

async function checkUserRegistration(uid: string) {
  console.log("Checking registration status for UID:", uid);
  const userDoc = await firestore().collection("users").doc(uid).get();
  console.log("User document exists:", userDoc.exists);
  return userDoc.exists;
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
      const userRef = firestore().collection("users").doc(user.uid);
      await userRef.set({
        uid: user.uid,
        displayName: payload.displayName,
        email: payload.email,
        photoURL: payload.photoURL || null,
        phoneNumber: user.phoneNumber || null,
        createdAt: firestore.FieldValue.serverTimestamp(),
        lastSeen: firestore.FieldValue.serverTimestamp(),
      });
      console.log("User profile registered successfully for:", user.uid);
      set({ isRegistered: true });
    } catch (error) {
      console.error("Failed to register user profile", error);
    }
  },

  // Sets up the Firebase auth listener. Call this ONCE at app start.
  _init: () => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      console.log("Auth state changed. Current user:", firebaseUser);
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
