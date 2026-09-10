import { create } from "zustand";

type FirebaseRequestState = {
  activeRequests: number;
  beginRequest: () => void;
  endRequest: () => void;
};

export const useFirebaseRequestStore = create<FirebaseRequestState>((set) => ({
  activeRequests: 0,
  beginRequest: () => set((state) => ({ activeRequests: state.activeRequests + 1 })),
  endRequest: () => set((state) => ({ activeRequests: Math.max(0, state.activeRequests - 1) })),
}));

export const beginFirebaseRequest = () =>
  useFirebaseRequestStore.getState().beginRequest();

export const endFirebaseRequest = () => useFirebaseRequestStore.getState().endRequest();

export async function withFirebaseRequest<T>(request: () => Promise<T>): Promise<T> {
  beginFirebaseRequest();
  try {
    return await request();
  } finally {
    endFirebaseRequest();
  }
}
