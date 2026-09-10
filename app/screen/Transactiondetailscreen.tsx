import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import auth from "@react-native-firebase/auth";
import {
  deletePaymentTransaction,
  getPaymentTransactions,
  PaymentTransaction,
  updatePaymentTransaction,
} from "./paymentService";

const formatCurrency = (amount: number) => `₹${Math.abs(amount).toLocaleString("en-IN")}`;

const formatDateTime = (date: Date | null) => {
  if (!date) return "Not available";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function TransactionDetailScreen() {
  const params = useLocalSearchParams<{
    contactId?: string;
    contactName?: string;
    transactionId?: string;
  }>();
  const contactId = typeof params.contactId === "string" ? params.contactId : "";
  const contactName = typeof params.contactName === "string" ? params.contactName : "Contact";
  const transactionId = typeof params.transactionId === "string" ? params.transactionId : "";
  const userId = auth().currentUser?.uid ?? "";

  const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const loadTransaction = async () => {
      try {
        const transactions = await getPaymentTransactions(userId, contactId);
        const selected = transactions.find((item) => item.id === transactionId) ?? null;
        if (active) {
          setTransaction(selected);
          setAmount(selected ? String(selected.amount) : "");
        }
      } catch (error) {
        if (active) Alert.alert("Failed to load transaction", (error as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (!userId || !contactId || !transactionId) return;

    void loadTransaction();
    return () => {
      active = false;
    };
  }, [contactId, transactionId, userId]);

  const handleSaveAmount = async () => {
    if (!transaction) return;
    const nextAmount = Number.parseFloat(amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      Alert.alert("Enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      await updatePaymentTransaction(userId, contactId, transaction, nextAmount);
      setTransaction({ ...transaction, amount: nextAmount });
      Alert.alert("Saved", "Transaction amount updated.");
    } catch (error) {
      Alert.alert("Failed to update transaction", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!transaction) return;
    Alert.alert("Delete transaction?", "This will update the contact balance.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await deletePaymentTransaction(userId, contactId, transaction);
              router.back();
            } catch (error) {
              Alert.alert("Failed to delete transaction", (error as Error).message);
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Transaction details</Text>
          <Text style={styles.headerSubtitle}>{contactName}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color="#2E7D6B" />
        </View>
      ) : !transaction ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>Transaction not found</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.detailCard}>
            <Text style={styles.typeLabel}>
              {transaction.type === "given" ? "You gave" : "You received"}
            </Text>
            <Text style={styles.amountDisplay}>{formatCurrency(transaction.amount)}</Text>
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!saving}
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => void handleSaveAmount()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save amount</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoSection}>
            <DetailRow label="Added by" value={transaction.addedBy} />
            <DetailRow label="Note" value={transaction.note?.trim() || "No note"} />
            <DetailRow label="Bill date" value={formatDateTime(transaction.billDate ?? null)} />
            <DetailRow label="Created" value={formatDateTime(transaction.createdAt)} />
          </View>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={saving}>
            <Text style={styles.deleteButtonText}>Delete transaction</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: { marginRight: 14, padding: 4 },
  backText: { fontSize: 24, color: "#1A1A1A" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1A1A1A" },
  headerSubtitle: { fontSize: 12, color: "#2E7D6B", marginTop: 2 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#777", fontSize: 14 },
  content: { padding: 16 },
  detailCard: { borderWidth: 1, borderColor: "#E1E8E5", borderRadius: 10, padding: 16 },
  typeLabel: { color: "#2E7D6B", fontSize: 14, fontWeight: "600" },
  amountDisplay: { color: "#1A1A1A", fontSize: 28, fontWeight: "700", marginTop: 4, marginBottom: 18 },
  fieldLabel: { color: "#666", fontSize: 12, marginBottom: 6 },
  amountInput: {
    borderWidth: 1,
    borderColor: "#D5DEDA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1A1A1A",
  },
  saveButton: { backgroundColor: "#2E7D6B", borderRadius: 8, alignItems: "center", paddingVertical: 11, marginTop: 12 },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  infoSection: { marginTop: 18 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  rowLabel: { color: "#777", fontSize: 13 },
  rowValue: { color: "#222", fontSize: 13, fontWeight: "600", maxWidth: "65%", textAlign: "right" },
  deleteButton: { borderWidth: 1, borderColor: "#C0392B", borderRadius: 8, alignItems: "center", paddingVertical: 12, marginTop: 24 },
  deleteButtonText: { color: "#C0392B", fontSize: 14, fontWeight: "700" },
});
