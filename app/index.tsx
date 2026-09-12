import { View, Text, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import React, { useState, useEffect } from "react";
import auth from "@react-native-firebase/auth";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { usePathname, useRouter } from "expo-router";
import { withFirebaseRequest } from "@/store/firebaseRequestStore";

const Login = () => {
  const pathname = usePathname();
  const router = useRouter();

  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [code, setCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (pathname === "/firebaseauth/link") router.back();
  }, [pathname, router]);

  // Handle the button press
  async function doSignInWithPhoneNumber() {
    const formattedPhoneNumber = phoneNumber.startsWith("+")
  ? phoneNumber
  : `+91${phoneNumber}`;
    const confirmation = await withFirebaseRequest(() =>
      auth().signInWithPhoneNumber(formattedPhoneNumber),
    );
    setConfirm(confirmation);
  }

  async function confirmCode() {
    if (!confirm) return;
    setError("");
    setLoading(true);
    try {
      await withFirebaseRequest(() => confirm.confirm(code.trim()));
    } catch (e: unknown) {
      setError("Invalid code, try again");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        paddingHorizontal: 24,
        gap: 12,
      }}
    >
      {!confirm ? (
        <>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="00000 00000"
            keyboardType="phone-pad"
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              padding: 12,
              width: "100%",
            }}
          />
          <TouchableOpacity
            onPress={doSignInWithPhoneNumber}
            disabled={loading}
            style={{
              backgroundColor: "#000",
              paddingVertical: 12,
              borderRadius: 8,
              width: "100%",
              alignItems: "center",
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff" }}>Send code</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Enter 6-digit code"
            keyboardType="number-pad"
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              padding: 12,
              width: "100%",
            }}
          />
          <TouchableOpacity
            onPress={confirmCode}
            disabled={loading}
            style={{
              backgroundColor: "#000",
              paddingVertical: 12,
              borderRadius: 8,
              width: "100%",
              alignItems: "center",
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff" }}>Verify code</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {!!error && <Text style={{ color: "red" }}>{error}</Text>}
    </View>
  );
};

export default Login;
