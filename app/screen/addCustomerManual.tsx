import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  KeyboardTypeOptions,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { RootStackParamList } from "@/types/navigation";
import { router } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

type Props = NativeStackScreenProps<RootStackParamList, "AddCustomerManual">;
// ---- Floating-label Input ----
interface FloatingInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  optionalLabel?: boolean;
}

const FloatingInput: React.FC<FloatingInputProps> = ({
  label,
  value,
  onChangeText,
  icon,
  placeholder,
  keyboardType = "default",
  optionalLabel,
}) => {
  const [focused, setFocused] = useState<boolean>(false);
  const borderColor = focused ? "#2E7D32" : "#D0D0D0";
  const labelColor = focused ? "#2E7D32" : "#999";

  return (
    <View style={[styles.inputWrapper, { borderColor }]}>
      <Text style={[styles.floatingLabel, { color: labelColor }]}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons
          name={"ice-cream-outline"}
          size={18}
          color={focused ? "#2E7D32" : "#666"}
          style={{ marginRight: 10 }}
        />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#B0B0B0"
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {optionalLabel && value.length === 0 && !focused && (
          <Text style={styles.optionalText}>Optional</Text>
        )}
      </View>
    </View>
  );
};

// ---- Header ----
const Header: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>Add Customer By Yourself</Text>
  </View>
);

// ---- Main Screen ----
const AddCustomerManualScreen: React.FC<Props> = ({ navigation, route }) => {
  const [name, setName] = useState<string>(route?.params?.name ?? "");
  const [phone, setPhone] = useState<string>(route?.params?.phone ?? "");

  const handleAddFromContacts = () => {
    router.push("/screen/addContact");
  };

  const handleConfirm = async () => {
    console.log("Confirm pressed", { name, phone });
     try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        throw new Error("No authenticated user available.");
      }

      const contactId = firestore()
        .collection("users")
        .doc(currentUser.uid)
        .collection("contact")
        .doc().id;
      const contactDetails = {
        contactId,
        name: name,
        phone: phone,
        updatedAt: firestore.Timestamp.now(),
      };

      const userRef = firestore().collection("users").doc(currentUser.uid);
      const wasSaved = await firestore().runTransaction(async (transaction) => {
        const userSnapshot = await transaction.get(userRef);
        const savedContacts = userSnapshot.data()?.contact;
        const contacts = Array.isArray(savedContacts) ? savedContacts : [];

        if (contacts.some((savedContact) => savedContact?.contactId === contactId)) {
          return false;
        }

        transaction.set(userRef, { contact: [...contacts, contactDetails] }, { merge: true });
        return true;
      });

      router.push("/(tabs)" as any);
    } catch (error) {
      console.error("Failed to save selected contact:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <Header onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.form}>
          <FloatingInput
            label="Name"
            value={name}
            onChangeText={setName}
            icon="user"
            placeholder="Enter name"
          />

          <FloatingInput
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            icon="smartphone"
            placeholder=""
            keyboardType="phone-pad"
            optionalLabel
          />

          <TouchableOpacity style={styles.contactsLink} onPress={handleAddFromContacts}>
            <Ionicons name="person-add" size={20} color="#2E7D32" />
            <Text style={styles.contactsLinkText}>Add from contacts</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.confirmBtn} activeOpacity={0.85} onPress={handleConfirm}>
          <Text style={styles.confirmBtnText}>Confirm</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AddCustomerManualScreen;

// ---- Styles ----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1A1A1A",
    marginLeft: 16,
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    marginBottom: 26,
    position: "relative",
  },
  floatingLabel: {
    position: "absolute",
    top: -10,
    left: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 6,
    fontSize: 13,
    fontWeight: "500",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1A1A1A",
    padding: 0,
  },
  optionalText: {
    fontSize: 15,
    color: "#BBBBBB",
  },
  contactsLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  contactsLinkText: {
    color: "#2E7D32",
    fontSize: 15.5,
    fontWeight: "600",
    marginLeft: 8,
  },
  confirmBtn: {
    backgroundColor: "#2E7D32",
    marginHorizontal: 20,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
