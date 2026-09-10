import React from "react";
import { StyleSheet, View } from "react-native";
import { useFirebaseRequestStore } from "@/store/firebaseRequestStore";

export default function GlobalFirebaseLoader() {
  const activeRequests = useFirebaseRequestStore((state) => state.activeRequests);

  if (activeRequests === 0) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={styles.progressBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  progressBar: {
    height: 3,
    backgroundColor: "#2E7D32",
  },
});
