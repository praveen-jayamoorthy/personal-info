import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { router } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

type Account = {
  id: string;
  name: string;
  subtitle: string;
  subtitleIcon: keyof typeof Ionicons.glyphMap;
  amount: number;
  type: "due" | "advance";
  initials: string;
  color: string;
};

type SavedContact = {
  contactId?: string;
  name?: string;
  phone?: string;
  color?: string;
  balanceDue?: number;
};

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

// ---- Avatar ----
const Avatar = ({ initials, color }: Pick<Account, "initials" | "color">) => (
  <View style={[styles.avatar, { backgroundColor: color }]}>
    <Text style={styles.avatarText}>{initials}</Text>
  </View>
);

// ---- Account Row ----
const AccountRow = ({ item }: { item: Account }) => {
  const isDue = item.type === "due";
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() =>
        router.push({
          pathname: "/screen/LedgerScreen",
          params: { contactId: item.id, contactName: item.name },
        })
      }
    >
      <Avatar initials={item.initials} color={item.color} />

      <View style={styles.rowContent}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.subtitleRow}>
          <Ionicons name={item.subtitleIcon} size={12} color="#8A8A8A" style={{ marginRight: 4 }} />
          <Text style={styles.subtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.amountBlock}>
        <Text style={[styles.amount, { color: isDue ? "#E53935" : "#2E7D32" }]}>
          {formatCurrency(item.amount)}
        </Text>
        <Text style={styles.amountLabel}>{isDue ? "Due" : "Advance"}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ---- Net Balance Header ----
const NetBalanceCard = ({ total, count }: { total: number; count: number }) => (
  <View style={styles.balanceCard}>
    <View>
      <Text style={styles.balanceLabel}>Net Balance</Text>
      <View style={styles.subtitleRow}>
        <Ionicons name="umbrella-sharp" size={13} color="#666" style={{ marginRight: 4 }} />
        <Text style={styles.accountsCount}>{count} Accounts</Text>
      </View>
    </View>

    <View style={styles.balanceRight}>
      <Text style={[styles.balanceAmount, { color: total < 0 ? "#2E7D32" : "#E53935" }]}>
        {formatCurrency(Math.abs(total))}
      </Text>
      <Text style={styles.balanceSub}>You Get</Text>
    </View>

    <View style={styles.divider} />

    <TouchableOpacity style={styles.filterBtn}>
      <Ionicons name="filter" size={20} color="#333" />
    </TouchableOpacity>
  </View>
);

// ---- Main Screen ----
export default function LedgerScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      return;
    }

    console.log(currentUser.uid)
    const unsubscribe = firestore()
      .collection("users")
      .doc(currentUser.uid)
      .onSnapshot(
        (snapshot) => {
          const savedContacts = snapshot.data()?.contact;
          const contacts = Array.isArray(savedContacts) ? (savedContacts as SavedContact[]) : [];

          setAccounts(
            contacts.map((contact, index) => {
              const name = contact.name?.trim() || "Unnamed contact";
              return {
                id: contact.contactId || `${name}-${index}`,
                name,
                subtitle: contact.phone || "Added from phonebook",
                subtitleIcon: contact.phone ? "call-outline" : "person-add-outline",
                amount: Math.abs(contact.balanceDue ?? 0),
                type: (contact.balanceDue ?? 0) >= 0 ? "due" : "advance",
                initials: name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase(),
                color: contact.color || "#4CAF50",
              };
            }),
          );
        },
        (error) => console.error("Failed to load saved contacts:", error),
      );

    return unsubscribe;
  }, []);

  const netBalance = accounts.reduce(
    (total, account) => total + (account.type === "due" ? account.amount : -account.amount),
    0,
  );
  const accountCount = accounts.length;

  return (
    <SafeAreaView style={styles.container}>
      <NetBalanceCard total={netBalance} count={accountCount} />

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AccountRow item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No contacts added yet</Text>}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push("/screen/addContact" as any)}
      >
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  balanceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EAF3EE",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 18,
    borderRadius: 16,
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  accountsCount: {
    fontSize: 13,
    color: "#666",
  },
  balanceRight: {
    alignItems: "flex-end",
    marginRight: 14,
  },
  balanceAmount: {
    fontSize: 22,
    fontWeight: "700",
    color: "#E53935",
  },
  balanceSub: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 34,
    backgroundColor: "#C9D8CE",
    marginRight: 12,
  },
  filterBtn: {
    padding: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  rowContent: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12.5,
    color: "#8A8A8A",
    flexShrink: 1,
  },
  amountBlock: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
  },
  amountLabel: {
    fontSize: 12,
    color: "#8A8A8A",
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: "#EFEFEF",
    marginLeft: 72,
  },
  emptyText: {
    textAlign: "center",
    color: "#8A8A8A",
    marginTop: 40,
  },
  addButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    backgroundColor: "#1f6feb",
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
