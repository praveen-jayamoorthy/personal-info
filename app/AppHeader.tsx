import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Set this to whatever your unread notification count is
const NOTIFICATION_COUNT = 1;

export default function AppHeader() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsProfileOpen((value) => !value)}
          style={styles.avatarButton}
        >
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>P</Text>
            </View>
            <View style={styles.avatarBadge}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="share-social-outline" size={20} color="#333" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={20} color="#333" />
            {NOTIFICATION_COUNT > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>{NOTIFICATION_COUNT}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="search-outline" size={20} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {isProfileOpen && (
        <Pressable
          style={styles.overlay}
          onPress={() => setIsProfileOpen(false)}
          android_ripple={{ color: "transparent" }}
        >
          <Pressable onPress={() => undefined} style={styles.profilePopup}>
            <View style={styles.popupHeaderRow}>
              <View style={[styles.avatar, styles.popupAvatar]}>
                <Text style={styles.avatarText}>P</Text>
              </View>

              <View style={styles.popupUserInfo}>
                <Text style={styles.popupName}>praveen personal</Text>
                <Text style={styles.popupPhone}>9655223771</Text>
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.8} style={styles.editButton}>
              <Ionicons name="create-outline" size={20} color="#1f1f1f" />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity activeOpacity={0.8} style={styles.businessRow}>
              <Ionicons name="add" size={28} color="#222" />
              <Text style={styles.businessText}>Create New Business</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#fff",
    paddingTop: 20,
  },
  container: {
    position: "relative",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  avatarButton: {
    alignSelf: "flex-start",
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4A90E2",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2ecc71",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e8ecef",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#e74c3c",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  notificationText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  overlay: {
    position: "absolute",
    top: 70,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    justifyContent: "flex-start",
    zIndex: 10,
  },
  profilePopup: {
    backgroundColor: "#fff",
    marginTop: 10,
    marginHorizontal: 12,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  popupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  popupAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#7AA9E8",
    marginRight: 14,
  },
  popupUserInfo: {
    flex: 1,
  },
  popupName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1b1b1b",
    marginBottom: 4,
  },
  popupPhone: {
    fontSize: 18,
    color: "#4d4d4d",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d8d8d8",
    borderRadius: 28,
    paddingVertical: 14,
    backgroundColor: "#f4f4f4",
  },
  editButtonText: {
    marginLeft: 10,
    fontSize: 22,
    color: "#1f1f1f",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#dfe3e8",
    marginVertical: 18,
  },
  businessRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  businessText: {
    marginLeft: 10,
    fontSize: 26,
    fontWeight: "700",
    color: "#1c1c1c",
  },
});
