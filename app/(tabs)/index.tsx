import React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { router } from "expo-router";

// ---- Mock Data ----
const accounts = [
  {
    id: "1",
    name: "Arul Komali",
    subtitle: "Added On 07 Aug, 2026",
    subtitleIcon: "user",
    amount: 0,
    type: "due", // due -> red, advance -> green
    initials: "AK",
    color: "#4CAF50",
  },
  {
    id: "2",
    name: "Suvel Ss",
    subtitle: "₹10,000 Payment Added on 05 Aug, 2026",
    subtitleIcon: "check",
    amount: 10000,
    type: "advance",
    initials: "SS",
    color: "#2196F3",
  },
  {
    id: "3",
    name: "Dharani.",
    subtitle: "₹2,000 Payment Added on 05 Aug, 2026",
    subtitleIcon: "check",
    amount: 0,
    type: "due",
    initials: "D",
    color: "#009688",
  },
  {
    id: "4",
    name: "iob jewel loan",
    subtitle: "₹5,00,000 Payment Edited on 30 Jul, 2026",
    subtitleIcon: "check",
    amount: 500000,
    type: "advance",
    initials: "I",
    color: "#E53935",
  },
];

const formatCurrency = (value) => `₹${value.toLocaleString("en-IN")}`;

// ---- Avatar ----
const Avatar = ({ initials, color }) => (
  <View style={[styles.avatar, { backgroundColor: color }]}>
    <Text style={styles.avatarText}>{initials}</Text>
  </View>
);

// ---- Account Row ----
const AccountRow = ({ item }) => {
  const isDue = item.type === "due";
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7}>
      <Avatar initials={item.initials} color={item.color} />

      <View style={styles.rowContent}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.subtitleRow}>
          <Ionicons
            name={item.subtitleIcon}
            size={12}
            color="#8A8A8A"
            style={{ marginRight: 4 }}
          />
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
const NetBalanceCard = ({ total, count }) => (
  <View style={styles.balanceCard}>
    <View>
      <Text style={styles.balanceLabel}>Net Balance</Text>
      <View style={styles.subtitleRow}>
        <Ionicons
          name="user"
          size={13}
          color="#666"
          style={{ marginRight: 4 }}
        />
        <Text style={styles.accountsCount}>{count} Accounts</Text>
      </View>
    </View>

    <View style={styles.balanceRight}>
      <Text style={styles.balanceAmount}>{formatCurrency(total)}</Text>
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
  const netBalance = 93560;
  const accountCount = 12;

  return (
    <SafeAreaView style={styles.container}>
      <NetBalanceCard total={netBalance} count={accountCount} />

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AccountRow item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push("/screen/addContact")}
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
