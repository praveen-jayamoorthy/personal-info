import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import React, { useState, useEffect } from "react";
import { Button, TextInput } from "react-native";
import auth from "@react-native-firebase/auth";
import { usePathname, useRouter } from "expo-router";
import { useAuthStore } from "@/store/authStore";

const index = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();

  console.log("User: ", user);

  const [confirm, setConfirm] = useState(null);
  const [code, setCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (pathname == "/firebaseauth/link") router.back();
  }, [pathname]);

  // Handle the button press
  async function signInWithPhoneNumber(phoneNumber) {
    console.log("phoneNumber", phoneNumber);
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    console.log("confirmation", confirmation);
    setConfirm(confirmation);
  }

  async function confirmCode() {
    if (!confirm) return;
    setError("");
    setLoading(true);
    try {
      await confirm.confirm(code.trim());
    } catch (e: any) {
      setError("Invalid code, try again");
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
            placeholder="+91 00000 00000"
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
            onPress={signInWithPhoneNumber}
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

export default index;
