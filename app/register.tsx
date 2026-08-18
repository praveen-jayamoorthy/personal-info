import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function RegisterScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isRegistered = useAuthStore((state) => state.isRegistered);
  const registerUserProfile = useAuthStore((state) => state.registerUserProfile);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }

    if (isRegistered) {
      router.replace("/");
    }
  }, [user, isRegistered, router]);

  async function handlePhotoPick(source: "library" | "camera") {
    if (!user) {
      return;
    }

    setError("");

    try {
      const permissionResult =
        source === "library"
          ? await ImagePicker.requestMediaLibraryPermissionsAsync()
          : await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow access to your photos or camera to add a profile picture.",
        );
        return;
      }

      const result =
        source === "library"
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
              base64: true,
            })
          : await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
              base64: true,
            });

      if (result.canceled || !result.assets?.[0]?.base64) {
        Alert.alert(
          "Photo not selected",
          "We could not read the selected image.",
        );
        return;
      }

      setUploadingPhoto(true);
      const pickedAsset = result.assets[0];
      const mimeType = pickedAsset.mimeType || "image/jpeg";
      const base64Image = `data:${mimeType};base64,${pickedAsset.base64}`;
      setPhotoURL(base64Image);
    } catch (err: any) {
      console.error(err);
      Alert.alert(
        "Photo upload failed",
        err?.message || "Unable to upload your photo.",
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    setError("");

    if (!displayName.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }

    setLoading(true);
    try {
      await registerUserProfile({
        displayName: displayName.trim(),
        email: email.trim(),
        photoURL: photoURL.trim() || undefined,
      });
      router.replace("/");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        justifyContent: "center",
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 16 }}>
        Complete profile
      </Text>

      <View style={{ width: "100%" }}>
        <Text style={{ marginBottom: 6, fontWeight: "600" }}>Name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Enter your name"
          maxLength={50}
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 8,
            padding: 12,
            width: "100%",
          }}
        />
      </View>

      <View style={{ width: "100%" }}>
        <Text style={{ marginBottom: 6, fontWeight: "600" }}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 8,
            padding: 12,
            width: "100%",
          }}
        />
      </View>

      <View style={{ width: "100%" }}>
        <Text style={{ marginBottom: 8, fontWeight: "600" }}>
          Profile photo
        </Text>

        {photoURL ? (
          <Image
            source={{ uri: photoURL }}
            style={{
              width: 110,
              height: 110,
              borderRadius: 55,
              alignSelf: "center",
              marginBottom: 8,
              backgroundColor: "#f0f0f0",
            }}
          />
        ) : (
          <View
            style={{
              width: 110,
              height: 110,
              borderRadius: 55,
              alignSelf: "center",
              marginBottom: 8,
              backgroundColor: "#f0f0f0",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#666" }}>Photo</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
        <TouchableOpacity
          onPress={() => handlePhotoPick("library")}
          disabled={uploadingPhoto}
          style={{
            flex: 1,
            backgroundColor: "#f2f2f2",
            paddingVertical: 12,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          {uploadingPhoto ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text>Upload photo</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handlePhotoPick("camera")}
          disabled={uploadingPhoto}
          style={{
            flex: 1,
            backgroundColor: "#f2f2f2",
            paddingVertical: 12,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          <Text>Take photo</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleSave}
        disabled={loading || uploadingPhoto}
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
          <Text style={{ color: "#fff" }}>Save profile</Text>
        )}
      </TouchableOpacity>

      {!!error && <Text style={{ color: "red" }}>{error}</Text>}
    </View>
  );
}