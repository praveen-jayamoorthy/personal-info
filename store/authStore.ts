// store/authStore.ts
import { create } from "zustand";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { userDetails } from "./type";

type RegisterProfilePayload = {
  displayName: string;
  email: string;
  photoURL?: string;
};

type AuthState = {
  user: FirebaseAuthTypes.User | null;
  initializing: boolean;
  isRegistered: boolean | null;
  userDetails: userDetails | null;
  registerUserProfile: (payload: RegisterProfilePayload) => Promise<void>;
  _init: () => () => void; // returns unsubscribe
};

async function checkUserRegistration(uid: string) {
  const userDoc = await firestore().collection("users").doc(uid).get();
  return userDoc;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initializing: true,
  isRegistered: null,
  userDetails: null,

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
      set({ isRegistered: true });
      set({
        userDetails: {
          uid: user.uid,
          displayName: payload.displayName,
          email: payload.email,
          photoURL: payload.photoURL || null,
          phoneNumber: user.phoneNumber || null,
        },
      });
    } catch (error) {
      console.error("Failed to register user profile", error);
    }
  },

  // Sets up the Firebase auth listener. Call this ONCE at app start.
  _init: () => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      set({ user: firebaseUser });

      if (!firebaseUser) {
        set({ isRegistered: null, initializing: false });
        return;
      }

      try {
        const userDoc = await checkUserRegistration(firebaseUser.uid);
        set({ isRegistered: userDoc.exists });
        set({ userDetails: userDoc.data() as userDetails });
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
