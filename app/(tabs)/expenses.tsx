import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { withFirebaseRequest } from "@/store/firebaseRequestStore";

type Expense = {
  id: string;
  name: string;
  amount: number;
  dueDate: { toDate: () => Date };
  startDate?: { toDate: () => Date };
  endDate?: { toDate: () => Date };
  completed?: boolean;
  notes?: string;
  paidAt?: { toDate: () => Date };
};

const currency = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
const dateLabel = (date: Date) =>
  date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const monthLabel = (date: Date) =>
  date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isActiveInMonth(expense: Expense, month: Date) {
  const start = expense.startDate?.toDate() ?? expense.dueDate.toDate();
  const end = expense.endDate?.toDate() ?? expense.dueDate.toDate();
  return start <= endOfMonth(month) && end >= startOfMonth(month);
}

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) return;
    const expensesRef = firestore().collection("users").doc(user.uid).collection("monthlyExpenses");
    const unsubscribe = expensesRef.onSnapshot(
      (snapshot) => {
        setExpenses(
          snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as Expense),
        );
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        Alert.alert("Unable to load expenses", error.message);
      },
    );
    return unsubscribe;
  }, []);

  const monthExpenses = useMemo(
    () => expenses.filter((expense) => isActiveInMonth(expense, selectedMonth)),
    [expenses, selectedMonth],
  );
  const sortedExpenses = useMemo(
    () =>
      monthExpenses.slice().sort((left, right) => {
        if (Boolean(left.completed) !== Boolean(right.completed)) return left.completed ? 1 : -1;
        return left.dueDate.toDate().getTime() - right.dueDate.toDate().getTime();
      }),
    [monthExpenses],
  );

  const pendingAmount = monthExpenses
    .filter((expense) => !expense.completed)
    .reduce((total, expense) => total + expense.amount, 0);
  const paidAmount = monthExpenses
    .filter((expense) => expense.completed)
    .reduce((total, expense) => total + expense.amount, 0);

  const addExpense = async () => {
    const user = auth().currentUser;
    const numericAmount = Number(amount);
    if (!user || !name.trim() || numericAmount <= 0) {
      Alert.alert("Enter an expense name and valid amount");
      return;
    }
    if (endDate < startDate) {
      Alert.alert("Invalid date range", "End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    try {
      const expenseRef = firestore()
        .collection("users")
        .doc(user.uid)
        .collection("monthlyExpenses")
        .doc();
      const expenseData = {
        name: name.trim(),
        amount: numericAmount,
        dueDate: firestore.Timestamp.fromDate(dueDate),
        startDate: firestore.Timestamp.fromDate(startOfMonth(startDate)),
        endDate: firestore.Timestamp.fromDate(endOfMonth(endDate)),
        completed: false,
        notes: "",
        createdAt: firestore.FieldValue.serverTimestamp(),
      };
      await withFirebaseRequest(() => expenseRef.set(expenseData));
      setExpenses((current) => [
        ...current,
        { id: expenseRef.id, ...expenseData, createdAt: undefined } as unknown as Expense,
      ]);
      setName("");
      setAmount("");
      setDueDate(new Date());
      setStartDate(new Date());
      setEndDate(new Date());
      setShowAdd(false);
    } catch (error) {
      Alert.alert("Unable to add expense", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const completeExpense = async () => {
    const user = auth().currentUser;
    if (!user || !selectedExpense) return;
    setSaving(true);
    try {
      const expenseRef = firestore()
        .collection("users")
        .doc(user.uid)
        .collection("monthlyExpenses")
        .doc(selectedExpense.id);
      const paymentData = {
        completed: true,
        notes: notes.trim(),
        paidAt: firestore.Timestamp.fromDate(paymentDate),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      await withFirebaseRequest(() => expenseRef.update(paymentData));
      setExpenses((current) =>
        current.map((expense) =>
          expense.id === selectedExpense.id
            ? { ...expense, completed: true, notes: notes.trim(), paidAt: paymentData.paidAt }
            : expense,
        ),
      );
      setShowComplete(false);
      setSelectedExpense(null);
      setNotes("");
    } catch (error) {
      Alert.alert("Unable to save payment", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openComplete = (expense: Expense) => {
    setSelectedExpense(expense);
    setPaymentDate(new Date());
    setNotes("");
    setShowComplete(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.subHeader}>
          <Text style={styles.title}>Monthly Expenses</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{expenses.length}</Text>
              <Text style={styles.summaryLabel}>Accounts</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, styles.pendingValue]}>
                {currency(pendingAmount)}
              </Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, styles.paidValue]}>{currency(paidAmount)}</Text>
              <Text style={styles.summaryLabel}>Paid</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Pending payments appear first</Text>
        </View>
        <TouchableOpacity style={styles.addIcon} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={25} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.monthSelector}>
        <TouchableOpacity
          onPress={() =>
            setSelectedMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          <Ionicons name="chevron-back" size={21} color="#B45309" />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthLabel(selectedMonth)}</Text>
        <TouchableOpacity
          onPress={() =>
            setSelectedMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          <Ionicons name="chevron-forward" size={21} color="#B45309" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loader} color="#B45309" />
      ) : (
        <FlatList
          data={sortedExpenses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No monthly expenses added yet.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.expenseCard, item.completed && styles.completedCard]}>
              <View style={styles.expenseTopRow}>
                <View style={styles.expenseIcon}>
                  <Ionicons
                    name={item.completed ? "checkmark" : "receipt-outline"}
                    size={20}
                    color={item.completed ? "#2E7D32" : "#B45309"}
                  />
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseName}>{item.name}</Text>
                  <Text style={styles.dueDate}>
                    {item.completed
                      ? `Paid ${item.paidAt ? dateLabel(item.paidAt.toDate()) : ""}`
                      : `Due ${dateLabel(item.dueDate.toDate())}`}
                  </Text>
                </View>
                <Text style={[styles.expenseAmount, item.completed && styles.completedText]}>
                  {currency(item.amount)}
                </Text>
              </View>
              {!item.completed && (
                <TouchableOpacity style={styles.completeButton} onPress={() => openComplete(item)}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.completeText}>Complete payment</Text>
                </TouchableOpacity>
              )}
              {item.completed && item.notes ? (
                <Text style={styles.notes}>Note: {item.notes}</Text>
              ) : null}
            </View>
          )}
        />
      )}
      <Modal
        visible={showAdd}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdd(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add monthly expense</Text>
            <TextInput
              style={styles.input}
              placeholder="Expense name"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Amount to pay"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={19} color="#B45309" />
              <View style={styles.dateText}>
                <Text style={styles.dateLabel}>Start date</Text>
                <Text style={styles.dateValue}>{dateLabel(startDate)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#718174" />
            </TouchableOpacity>
            {showStartDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(event: DateTimePickerEvent, selected?: Date) => {
                  setShowStartDatePicker(false);
                  if (selected) setStartDate(selected);
                }}
              />
            )}
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDatePicker(true)}>
              <Ionicons name="calendar-outline" size={19} color="#B45309" />
              <View style={styles.dateText}>
                <Text style={styles.dateLabel}>End date</Text>
                <Text style={styles.dateValue}>{dateLabel(endDate)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#718174" />
            </TouchableOpacity>
            {showEndDatePicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={(event: DateTimePickerEvent, selected?: Date) => {
                  setShowEndDatePicker(false);
                  if (selected) setEndDate(selected);
                }}
              />
            )}
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDueDatePicker(true)}>
              <Ionicons name="calendar-outline" size={19} color="#B45309" />
              <View style={styles.dateText}>
                <Text style={styles.dateLabel}>Due date</Text>
                <Text style={styles.dateValue}>{dateLabel(dueDate)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#718174" />
            </TouchableOpacity>
            {showDueDatePicker && (
              <DateTimePicker
                value={dueDate}
                mode="date"
                display="default"
                onChange={(event: DateTimePickerEvent, selected?: Date) => {
                  setShowDueDatePicker(false);
                  if (selected) setDueDate(selected);
                }}
              />
            )}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAdd(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => void addExpense()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showComplete}
        transparent
        animationType="slide"
        onRequestClose={() => setShowComplete(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Complete payment</Text>
            <Text style={styles.modalExpense}>
              {selectedExpense?.name} • {selectedExpense ? currency(selectedExpense.amount) : ""}
            </Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Notes (optional)"
              multiline
              value={notes}
              onChangeText={setNotes}
            />
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowPaymentDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={19} color="#2E7D32" />
              <View style={styles.dateText}>
                <Text style={styles.dateLabel}>Payment date</Text>
                <Text style={styles.dateValue}>{dateLabel(paymentDate)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#718174" />
            </TouchableOpacity>
            {showPaymentDatePicker && (
              <DateTimePicker
                value={paymentDate}
                mode="date"
                display="default"
                onChange={(event: DateTimePickerEvent, selected?: Date) => {
                  setShowPaymentDatePicker(false);
                  if (selected) setPaymentDate(selected);
                }}
              />
            )}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowComplete(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => void completeExpense()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFDF8" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    width: "100%",
  },
  subHeader: {
    flex: 1,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#3B2A16" },
  subtitle: { color: "#8A7965", marginTop: 4 },
  addIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginLeft: 12,
    backgroundColor: "#B45309",
    alignItems: "center",
    justifyContent: "center",
  },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF4E3",
    borderRadius: 10,
  },
  monthTitle: { color: "#7C3F09", fontWeight: "700", fontSize: 16 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1DFC5",
    borderRadius: 12,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { color: "#30271F", fontSize: 16, fontWeight: "700" },
  pendingValue: { color: "#B45309" },
  paidValue: { color: "#2E7D32" },
  summaryLabel: { color: "#8A7965", fontSize: 11, marginTop: 4 },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: "center", color: "#8A7965", marginTop: 48 },
  expenseCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1DFC5",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  completedCard: { borderColor: "#D9E8DA", backgroundColor: "#FBFEFB" },
  expenseTopRow: { flexDirection: "row", alignItems: "center" },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF0D9",
    alignItems: "center",
    justifyContent: "center",
  },
  expenseInfo: { flex: 1, marginLeft: 12 },
  expenseName: { fontSize: 17, fontWeight: "700", color: "#30271F" },
  dueDate: { color: "#8A7965", marginTop: 4 },
  expenseAmount: { color: "#B45309", fontSize: 17, fontWeight: "700" },
  completedText: { color: "#2E7D32" },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#B45309",
    borderRadius: 9,
    paddingVertical: 11,
    marginTop: 14,
  },
  completeText: { color: "#FFFFFF", fontWeight: "700" },
  notes: { color: "#718174", fontSize: 12, marginTop: 10 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#30271F", marginBottom: 16 },
  modalExpense: { color: "#718174", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#E2D5C4",
    borderRadius: 8,
    padding: 13,
    marginBottom: 10,
    color: "#30271F",
  },
  notesInput: { minHeight: 76, textAlignVertical: "top" },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2D5C4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  dateText: { flex: 1, marginLeft: 10 },
  dateLabel: { color: "#8A7965", fontSize: 12 },
  dateValue: { color: "#30271F", fontWeight: "600", marginTop: 3 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 },
  cancelButton: { padding: 12 },
  saveButton: {
    backgroundColor: "#B45309",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveText: { color: "#FFFFFF", fontWeight: "700" },
});
