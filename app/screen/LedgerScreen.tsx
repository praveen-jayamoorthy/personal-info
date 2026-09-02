import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useLedger } from "./useLedger";
import { PaymentTransaction, TransactionType } from "./paymentService";
import auth from "@react-native-firebase/auth";

// Optional: swap for @expo/vector-icons or react-native-vector-icons
const ICONS: Record<string, string> = {
  back: "←",
  doc: "📄",
  search: "🔍",
  chat: "💬",
  call: "📞",
  whatsapp: "🟢",
  more: "⋯",
  calendar: "📅",
  up: "↑",
  down: "↓",
  chevron: "›",
};
const Icon = ({
  name,
  size = 20,
  color = "#000",
}: {
  name: string;
  size?: number;
  color?: string;
}) => <Text style={{ fontSize: size, color }}>{ICONS[name] || "•"}</Text>;

const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

const formatCurrency = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN")}`;

const formatTime = (d: Date | null) => {
  if (!d) return "...";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (d: Date | null) => {
  if (!d) return "";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Groups a flat, time-ordered transaction list into date-labelled sections
 *  and computes the running "due after" balance for each entry. */
function groupByDate(transactions: PaymentTransaction[]) {
  const groups: { date: string; entries: (PaymentTransaction & { dueAfter: number })[] }[] = [];
  let running = 0;

  for (const tx of transactions) {
    running += tx.type === "given" ? tx.amount : -tx.amount;
    const dateLabel = formatDate(tx.createdAt);
    const entry = { ...tx, dueAfter: running };

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.date === dateLabel) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ date: dateLabel, entries: [entry] });
    }
  }
  return groups;
}

function TransactionCard({ entry }: { entry: PaymentTransaction & { dueAfter: number } }) {
  const isGiven = entry.type === "given";
  return (
    <View style={[styles.cardWrapper, { alignSelf: isGiven ? "flex-end" : "flex-start" }]}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderText}>Added by {entry.addedBy}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.amountRow}>
            <Icon name={isGiven ? "up" : "down"} size={16} color="#1A1A1A" />
            <Text style={styles.amountText}>{formatCurrency(entry.amount)}</Text>
          </View>
          <Text style={styles.timeText}>{formatTime(entry.createdAt)}</Text>
        </View>
      </View>
      <Text style={[styles.dueLabel, { alignSelf: isGiven ? "flex-end" : "flex-start" }]}>
        {formatCurrency(Math.abs(entry.dueAfter))} {entry.dueAfter >= 0 ? "Due" : "Advance"}
      </Text>
    </View>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.dateSeparatorContainer}>
      <View style={styles.datePill}>
        <Text style={styles.datePillText}>{label}</Text>
      </View>
    </View>
  );
}

interface AmountModalProps {
  visible: boolean;
  type: TransactionType | null;
  onClose: () => void;
  onSubmit: (amount: number, note?: string) => Promise<void>;
}

function AmountModal({ visible, type, onClose, onSubmit }: AmountModalProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isGiven = type === "given";

  const handleSubmit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      Alert.alert("Enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(value, note.trim() || undefined);
      setAmount("");
      setNote("");
      onClose();
    } catch (err) {
      Alert.alert("Failed to save", (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{isGiven ? "You Gave ₹" : "You Received ₹"}</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Amount"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            autoFocus
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Note (optional)"
            value={note}
            onChangeText={setNote}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: isGiven ? "#C0392B" : "#2E7D32" }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function LedgerScreen() {
  const params = useLocalSearchParams<{ contactId?: string; contactName?: string }>();
  const contactId = typeof params.contactId === "string" ? params.contactId : "";
  const contactName = typeof params.contactName === "string" ? params.contactName : "Contact";

  // Swap this for however you access the signed-in user elsewhere in the app
  // (Firebase Auth context, Redux, Zustand, etc.)
  const currentUser = auth().currentUser;
  const userId = currentUser?.uid ?? "";
  const currentUserName = currentUser?.displayName ?? "You";

  const { transactions, summary, loading, error, recordPayment } = useLedger(
    userId,
    contactId,
    contactName,
    currentUserName,
  );

  const [modalType, setModalType] = useState<TransactionType | null>(null);

  const grouped = useMemo(() => groupByDate(transactions), [transactions]);
  const balanceDue = summary?.balanceDue ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={hitSlop}>
          <Icon name="back" size={22} />
        </TouchableOpacity>

        <View style={[styles.avatar, { backgroundColor: "#4DD0C8" }]}>
          <Text style={styles.avatarText}>{contactName.charAt(0)}</Text>
        </View>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerName}>{contactName}</Text>
          <TouchableOpacity>
            <Text style={styles.viewProfile}>View Profile</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.headerIconBtn} hitSlop={hitSlop}>
          <Icon name="doc" size={20} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconBtn} hitSlop={hitSlop}>
          <Icon name="search" size={20} />
        </TouchableOpacity>
      </View>

      {/* Transaction list */}
      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color="#2E7D6B" />
        </View>
      ) : error ? (
        <View style={styles.centerFill}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {grouped.length === 0 ? (
            <View style={styles.centerFill}>
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            grouped.map((group, idx) => (
              <View key={idx}>
                <DateSeparator label={group.date} />
                {group.entries.map((entry) => (
                  <TransactionCard key={entry.id} entry={entry} />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Quick actions row */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickIconBtn}>
          <Icon name="doc" size={16} color="#3A6F63" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickIconBtn}>
          <Icon name="chat" size={16} color="#3A6F63" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickIconBtn}>
          <Icon name="call" size={16} color="#3A6F63" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickIconBtn}>
          <Icon name="whatsapp" size={16} color="#3A6F63" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.moreBtn}>
          <Text style={styles.moreText}>More</Text>
          <Icon name="more" size={16} color="#3A6F63" />
        </TouchableOpacity>
      </View>

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        <View style={styles.dueDateRow}>
          <TouchableOpacity style={styles.dueDateBtn}>
            <Icon name="calendar" size={14} color="#2E7D6B" />
            <Text style={styles.dueDateText}>Due Date</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.callBtn}>
            <Icon name="call" size={14} color="#fff" />
            <Text style={styles.callBtnText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.remindBtn}>
            <Icon name="whatsapp" size={14} color="#fff" />
            <Text style={styles.remindBtnText}>Remind</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Balance Due</Text>
          <View style={styles.balanceValueRow}>
            <Text style={[styles.balanceValue, { color: balanceDue >= 0 ? "#C0392B" : "#2E7D32" }]}>
              {formatCurrency(balanceDue)}
            </Text>
            <Icon name="chevron" size={20} color={balanceDue >= 0 ? "#C0392B" : "#2E7D32"} />
          </View>
        </TouchableOpacity>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.receivedBtn]}
            onPress={() => setModalType("received")}
          >
            <Icon name="down" size={16} color="#2E7D32" />
            <Text style={[styles.actionBtnText, { color: "#2E7D32" }]}>Received</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.givenBtn]}
            onPress={() => setModalType("given")}
          >
            <Icon name="up" size={16} color="#C0392B" />
            <Text style={[styles.actionBtnText, { color: "#C0392B" }]}>Given</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AmountModal
        visible={modalType !== null}
        type={modalType}
        onClose={() => setModalType(null)}
        onSubmit={(amount, note) => recordPayment(modalType as TransactionType, amount, note)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  headerTextContainer: { marginLeft: 10, flex: 1 },
  headerName: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  viewProfile: { fontSize: 12, color: "#2E7D6B", marginTop: 2 },
  headerIconBtn: { marginLeft: 18 },

  body: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  errorText: { color: "#C0392B", fontSize: 13 },
  emptyText: { color: "#999", fontSize: 13 },

  dateSeparatorContainer: { alignItems: "center", marginVertical: 10 },
  datePill: {
    backgroundColor: "#4E7C74",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
  },
  datePillText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  cardWrapper: { maxWidth: "78%", marginBottom: 14 },
  card: {
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  cardHeader: {
    backgroundColor: "#E4EFEC",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cardHeaderText: { fontSize: 12, color: "#3A6F63", fontWeight: "600" },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  amountRow: { flexDirection: "row", alignItems: "center" },
  amountText: { fontSize: 18, fontWeight: "700", color: "#1A1A1A", marginLeft: 4 },
  timeText: { fontSize: 11, color: "#8A8A8A", marginLeft: 8 },
  dueLabel: { fontSize: 12, color: "#555", marginTop: 4 },

  quickActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#E9F1EE",
  },
  quickIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  moreBtn: { flexDirection: "row", alignItems: "center" },
  moreText: { fontSize: 13, color: "#3A6F63", marginRight: 4, fontWeight: "600" },

  bottomPanel: {
    backgroundColor: "#F4F8F7",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#E0E7E5",
  },
  dueDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  dueDateBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2E7D6B",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dueDateText: { color: "#2E7D6B", fontSize: 13, fontWeight: "600", marginLeft: 6 },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E7D6B",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  callBtnText: { color: "#fff", fontSize: 13, fontWeight: "600", marginLeft: 6 },
  remindBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E7D6B",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  remindBtnText: { color: "#fff", fontSize: 13, fontWeight: "600", marginLeft: 6 },

  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  balanceLabel: { fontSize: 14, color: "#333" },
  balanceValueRow: { flexDirection: "row", alignItems: "center" },
  balanceValue: { fontSize: 18, fontWeight: "700", marginRight: 2 },

  actionButtonsRow: { flexDirection: "row", marginTop: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 24,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  receivedBtn: { borderColor: "#2E7D32", backgroundColor: "#fff" },
  givenBtn: { borderColor: "#C0392B", backgroundColor: "#fff" },
  actionBtnText: { fontSize: 14, fontWeight: "700", marginLeft: 6 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 14, color: "#1A1A1A" },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { color: "#666", fontSize: 14, fontWeight: "600" },
  modalSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  modalSaveText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
