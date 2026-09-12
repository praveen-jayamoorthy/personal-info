import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Switch,
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

type RentMode = "rent" | "interest";
type RentDirection = "given" | "received";

type RentContact = {
  contactId: string;
  name: string;
  phone?: string;
  balanceDue?: number;
  rentMode?: RentMode;
  rentDirection?: RentDirection;
  rentAmount?: number;
  interestRate?: number;
  interestPrincipal?: number;
  rentStartDate?: { toDate: () => Date };
  rentEndDate?: { toDate: () => Date };
  disabled?: boolean;
};

type MonthSummary = {
  key: string;
  label: string;
  accrued: number;
  received: number;
  due: number;
  status: "paid" | "partial" | "due";
  payments: { date: Date; amount: number }[];
};

type RentTransaction = {
  id: string;
  type?: string;
  amount?: number;
  billDate?: { toDate: () => Date };
  createdAt?: { toDate: () => Date };
};

const currency = (value: number) => `₹${Math.round(Math.max(value, 0)).toLocaleString("en-IN")}`;
const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (date: Date) =>
  date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthsBetween(start: Date, end: Date) {
  const first = startOfMonth(start);
  const last = startOfMonth(end);
  return Math.max(
    0,
    (last.getFullYear() - first.getFullYear()) * 12 + last.getMonth() - first.getMonth() + 1,
  );
}

function calculationEndDate(contact: RentContact) {
  const today = startOfMonth(new Date());
  const serviceEnd = contact.rentEndDate?.toDate();
  return serviceEnd && startOfMonth(serviceEnd) < today ? startOfMonth(serviceEnd) : today;
}

function monthlyAmount(contact: RentContact) {
  if (contact.rentMode === "interest") {
    return (
      ((contact.interestPrincipal ?? contact.balanceDue ?? 0) * (contact.interestRate ?? 0)) / 100
    );
  }
  return contact.rentAmount ?? 0;
}

function buildMonths(
  contact: RentContact,
  transactions: Record<string, RentTransaction[]>,
): MonthSummary[] {
  if (!contact.rentStartDate || monthlyAmount(contact) <= 0) return [];
  const start = contact.rentStartDate.toDate();
  const amount = monthlyAmount(contact);
  const receivedPayments = (transactions[contact.contactId] ?? [])
    .filter((transaction) => transaction.type === (contact.rentDirection ?? "received"))
    .map((transaction) => ({
      date: transaction.billDate?.toDate() ?? transaction.createdAt?.toDate(),
      amount: transaction.amount ?? 0,
      allocated: 0,
    }))
    .filter(
      (payment): payment is { date: Date; amount: number; allocated: number } =>
        Boolean(payment.date) && payment.amount > 0,
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime());
  const result: MonthSummary[] = [];
  let paymentIndex = 0;

  for (let index = 0; index < monthsBetween(start, calculationEndDate(contact)); index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const key = monthKey(date);
    let due = amount;
    const payments: { date: Date; amount: number }[] = [];

    while (due > 0 && paymentIndex < receivedPayments.length) {
      const payment = receivedPayments[paymentIndex];
      const remainingPayment = payment.amount - payment.allocated;
      const appliedAmount = Math.min(due, remainingPayment);
      if (appliedAmount > 0) {
        payments.push({ date: payment.date, amount: appliedAmount });
        payment.allocated += appliedAmount;
        due -= appliedAmount;
      }
      if (payment.allocated >= payment.amount) paymentIndex += 1;
    }

    const receivedAmount = amount - due;
    result.push({
      key,
      label: monthLabel(date),
      accrued: amount,
      received: receivedAmount,
      due,
      status: due === 0 ? "paid" : receivedAmount > 0 ? "partial" : "due",
      payments,
    });
  }
  return result;
}

function paymentDateLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RentScreen() {
  const [contacts, setContacts] = useState<RentContact[]>([]);
  const [transactions, setTransactions] = useState<Record<string, RentTransaction[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<RentContact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<RentMode>("rent");
  const [direction, setDirection] = useState<RentDirection>("received");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [principal, setPrincipal] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [receiveContact, setReceiveContact] = useState<RentContact | null>(null);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [receiveDate, setReceiveDate] = useState(new Date());
  const [showReceiveDatePicker, setShowReceiveDatePicker] = useState(false);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<{
    contactId: string;
    payment: RentTransaction;
  } | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [expandedContacts, setExpandedContacts] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const loadData = async (includeDisabled = showDisabled) => {
    const user = auth().currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const userSnapshot = await withFirebaseRequest(() =>
        firestore().collection("users").doc(user.uid).get(),
      );
      const savedContacts = userSnapshot.data()?.rentContacts;
      const activeContacts = (Array.isArray(savedContacts) ? savedContacts : [])
        .filter((contact) => (includeDisabled || contact?.disabled !== true) && contact?.contactId)
        .map((contact) => contact as RentContact);
      const transactionEntries = await Promise.all(
        activeContacts.map(async (contact) => {
          const snapshot = await withFirebaseRequest(() =>
            firestore()
              .collection("users")
              .doc(user.uid)
              .collection("rentContacts")
              .doc(contact.contactId)
              .collection("transactions")
              .get(),
          );
          return [
            contact.contactId,
            snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as RentTransaction[],
          ] as const;
        }),
      );
      setContacts(activeContacts);
      setTransactions(Object.fromEntries(transactionEntries));
    } catch (error) {
      Alert.alert("Unable to load rent details", (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const task = setTimeout(() => void loadData(showDisabled), 0);
    return () => clearTimeout(task);
  }, [showDisabled]);

  const openForm = (contact?: RentContact) => {
    setSelectedContact(contact ?? null);
    setMode(contact?.rentMode ?? "rent");
    setDirection(contact?.rentDirection ?? "received");
    setAmount(contact?.rentAmount ? String(contact.rentAmount) : "");
    setRate(contact?.interestRate ? String(contact.interestRate) : "");
    setPrincipal(contact?.interestPrincipal ? String(contact.interestPrincipal) : "");
    setContactName(contact?.name ?? "");
    setContactPhone(contact?.phone ?? "");
    setStartDate(contact?.rentStartDate?.toDate() ?? new Date());
    setEndDate(contact?.rentEndDate?.toDate() ?? null);
    setShowForm(true);
  };

  const saveConfiguration = async () => {
    const user = auth().currentUser;
    const numericAmount = Number(amount);
    const numericRate = Number(rate);
    const numericPrincipal = Number(principal);
    if (!user || !contactName.trim()) {
      Alert.alert("Enter a contact name");
      return;
    }
    if (!selectedContact && mode === "rent" && numericAmount <= 0) {
      Alert.alert("Enter rent amount");
      return;
    }
    if (!selectedContact && mode === "interest" && (numericRate <= 0 || numericPrincipal <= 0)) {
      Alert.alert("Enter interest rate and principal amount");
      return;
    }
    if (endDate && startOfMonth(endDate) < startOfMonth(startDate)) {
      Alert.alert("Invalid end date", "The end date must be after the start month.");
      return;
    }

    setSaving(true);
    try {
      const userRef = firestore().collection("users").doc(user.uid);
      await withFirebaseRequest(() =>
        firestore().runTransaction(async (transaction) => {
          const snapshot = await transaction.get(userRef);
          const savedContacts = snapshot.data()?.rentContacts;
          const currentContacts = Array.isArray(savedContacts) ? savedContacts : [];
          const contactId =
            selectedContact?.contactId ?? userRef.collection("rentContacts").doc().id;
          const rentContact = {
            contactId,
            name: contactName.trim(),
            phone: contactPhone.trim(),
            rentMode: mode,
            rentDirection: direction,
            rentAmount: mode === "rent" ? numericAmount : 0,
            interestRate: mode === "interest" ? numericRate : 0,
            interestPrincipal: mode === "interest" ? numericPrincipal : 0,
            updatedAt: firestore.Timestamp.now(),
            rentStartDate: firestore.Timestamp.fromDate(startOfMonth(startDate)),
            rentEndDate: endDate ? firestore.Timestamp.fromDate(endDate) : null,
          };
          const updatedContacts = selectedContact
            ? currentContacts.map((contact) =>
                contact?.contactId === selectedContact.contactId ? rentContact : contact,
              )
            : [...currentContacts, rentContact];
          transaction.set(userRef, { rentContacts: updatedContacts }, { merge: true });
        }),
      );
      setShowForm(false);
      await loadData(showDisabled);
    } catch (error) {
      Alert.alert("Unable to save rent details", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const disableRentContact = async () => {
    const user = auth().currentUser;
    if (!user || !selectedContact) return;
    setSaving(true);
    try {
      const userRef = firestore().collection("users").doc(user.uid);
      await withFirebaseRequest(() =>
        firestore().runTransaction(async (transaction) => {
          const snapshot = await transaction.get(userRef);
          const savedContacts = snapshot.data()?.rentContacts;
          const currentContacts = Array.isArray(savedContacts) ? savedContacts : [];
          const updatedContacts = currentContacts.map((contact) =>
            contact?.contactId === selectedContact.contactId
              ? { ...contact, disabled: true, updatedAt: firestore.Timestamp.now() }
              : contact,
          );
          transaction.set(userRef, { rentContacts: updatedContacts }, { merge: true });
        }),
      );
      setShowForm(false);
      await loadData(showDisabled);
    } catch (error) {
      Alert.alert("Unable to disable contact", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const recordReceived = async () => {
    const user = auth().currentUser;
    const numericAmount = Number(receiveAmount);

    if (!user || !receiveContact || numericAmount <= 0) {
      Alert.alert(`Enter a valid ${direction === "given" ? "given" : "received"} amount`);
      return;
    }
    setSaving(true);
    try {
      const transactionRef = firestore()
        .collection("users")
        .doc(user.uid)
        .collection("rentContacts")
        .doc(receiveContact.contactId)
        .collection("transactions")
        .doc();
      await withFirebaseRequest(() =>
        transactionRef.set({
          type: direction,
          amount: numericAmount,
          billDate: firestore.Timestamp.fromDate(receiveDate),
          createdAt: firestore.FieldValue.serverTimestamp(),
        }),
      );
      setShowReceiveForm(false);
      setReceiveAmount("");
      await loadData();
    } catch (error) {
      Alert.alert(
        `Unable to save ${direction === "given" ? "given" : "received"} amount`,
        (error as Error).message,
      );
    } finally {
      setSaving(false);
    }
  };

  const openPaymentEditor = (contactId: string, payment: RentTransaction) => {
    setEditingPayment({ contactId, payment });
    setEditAmount(String(payment.amount ?? ""));
    setEditDate(payment.billDate?.toDate() ?? payment.createdAt?.toDate() ?? new Date());
  };

  const updateReceivedPayment = async () => {
    const user = auth().currentUser;
    const numericAmount = Number(editAmount);
    if (!user || !editingPayment || numericAmount <= 0) {
      Alert.alert("Enter a valid received amount");
      return;
    }
    setSaving(true);
    try {
      const paymentRef = firestore()
        .collection("users")
        .doc(user.uid)
        .collection("rentContacts")
        .doc(editingPayment.contactId)
        .collection("transactions")
        .doc(editingPayment.payment.id);
      await withFirebaseRequest(() =>
        paymentRef.update({
          amount: numericAmount,
          billDate: firestore.Timestamp.fromDate(editDate),
        }),
      );
      setEditingPayment(null);
      await loadData();
    } catch (error) {
      Alert.alert("Unable to update payment", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totalOutstanding = contacts.reduce(
    (total, contact) =>
      total + buildMonths(contact, transactions).reduce((sum, month) => sum + month.due, 0),
    0,
  );
  const totalSettled = contacts.reduce(
    (total, contact) =>
      total +
      (transactions[contact.contactId] ?? [])
        .filter((transaction) => transaction.type === (contact.rentDirection ?? "received"))
        .reduce((sum, transaction) => sum + (transaction.amount ?? 0), 0),
    0,
  );
  const hasGiven = contacts.some((contact) => contact.rentDirection === "given");
  const hasReceived = contacts.some(
    (contact) => (contact.rentDirection ?? "received") === "received",
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Rent & Interest</Text>
          <Text style={styles.subtitle}>Monthly rent and interest tracking</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setShowFilterMenu((visible) => !visible)}
          >
            <Ionicons name="filter-outline" size={23} color="#1B5E20" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => openForm()}>
            <Ionicons name="person-add-outline" size={26} color="#1B5E20" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{contacts.length}</Text>
          <Text style={styles.summaryLabel}>Accounts</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, styles.summaryDue]}>{currency(totalOutstanding)}</Text>
          <Text style={styles.summaryLabel}>
            {hasGiven && hasReceived ? "Outstanding" : hasGiven ? "To give" : "To receive"}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, styles.summaryReceived]}>
            {currency(totalSettled)}
          </Text>
          <Text style={styles.summaryLabel}>
            {hasGiven && hasReceived ? "Settled" : hasGiven ? "Given" : "Received"}
          </Text>
        </View>
      </View>
      {showFilterMenu && (
        <View style={styles.filterMenu}>
          <Text style={styles.filterLabel}>Show disabled contacts</Text>
          <Switch
            value={showDisabled}
            onValueChange={setShowDisabled}
            trackColor={{ false: "#CBD8CC", true: "#A5C9A7" }}
            thumbColor={showDisabled ? "#2E7D32" : "#F4F4F4"}
          />
        </View>
      )}
      {loading ? (
        <ActivityIndicator style={styles.loader} color="#1B5E20" />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.contactId}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Add a contact first to configure rent or interest.</Text>
          }
          renderItem={({ item }) => {
            const months = buildMonths(item, transactions);
            const minimumVisibleMonths = months.slice(-6);
            const unpaidMonths = months.filter((month) => month.status !== "paid");
            const visibleMonthKeys = new Set(
              [...minimumVisibleMonths, ...unpaidMonths].map((month) => month.key),
            );
            const visibleMonths = months.filter((month) => visibleMonthKeys.has(month.key));
            const accrued = months.reduce((total, month) => total + month.accrued, 0);
            const received = months.reduce((total, month) => total + month.received, 0);
            const due = Math.max(accrued - received, 0);
            const configured = months.length > 0;
            const isExpanded = expandedContacts[item.contactId] ?? true;
            const paymentHistory = (transactions[item.contactId] ?? [])
              .filter((payment) => payment.type === (item.rentDirection ?? "received"))
              .sort((left, right) => {
                const leftDate = left.billDate?.toDate() ?? left.createdAt?.toDate() ?? new Date(0);
                const rightDate =
                  right.billDate?.toDate() ?? right.createdAt?.toDate() ?? new Date(0);
                return rightDate.getTime() - leftDate.getTime();
              });
            return (
              <View style={styles.contactCard}>
                <View style={styles.contactHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <View style={styles.nameStatusRow}>
                      <Text style={styles.contactName}>{item.name}</Text>
                      {item.disabled && <Text style={styles.disabledBadge}>Disabled</Text>}
                    </View>
                    <Text style={styles.contactMode}>
                      {configured
                        ? `${item.rentMode === "interest" ? `${item.interestRate}% interest` : "Fixed rent"} • ${currency(monthlyAmount(item))}/month • ${item.rentDirection === "given" ? "Given" : "Received"}`
                        : "Not configured"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => openForm(item)}>
                    <Ionicons name="create-outline" size={22} color="#1B5E20" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={() =>
                      setExpandedContacts((current) => ({
                        ...current,
                        [item.contactId]: !isExpanded,
                      }))
                    }
                  >
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={22}
                      color="#718174"
                    />
                  </TouchableOpacity>
                </View>
                {isExpanded &&
                  (configured ? (
                    <>
                      <View style={styles.totalsRow}>
                        <View>
                          <Text style={styles.totalLabel}>
                            {item.rentDirection === "given" ? "To give" : "To receive"}
                          </Text>
                          <Text style={styles.due}>{currency(due)}</Text>
                        </View>
                        <View>
                          <Text style={styles.totalLabel}>
                            {item.rentDirection === "given" ? "Given" : "Received"}
                          </Text>
                          <Text style={styles.received}>{currency(received)}</Text>
                        </View>
                        <View>
                          <Text style={styles.totalLabel}>Accrued</Text>
                          <Text style={styles.totalValue}>{currency(accrued)}</Text>
                        </View>
                      </View>
                      <View style={styles.monthList}>
                        {visibleMonths
                          .slice()
                          .reverse()
                          .map((month) => (
                            <View style={styles.monthBlock} key={month.key}>
                              <View style={styles.monthRow}>
                                <Text style={styles.monthLabel}>{month.label}</Text>
                                <Text style={styles.monthAmount}>{currency(month.accrued)}</Text>
                                <Text
                                  style={[
                                    styles.monthStatus,
                                    month.status === "partial"
                                      ? styles.partial
                                      : month.status === "due"
                                        ? styles.due
                                        : styles.received,
                                  ]}
                                >
                                  {month.status === "paid"
                                    ? "Paid"
                                    : `${currency(month.due)} ${month.status === "partial" ? "partial" : "due"}`}
                                </Text>
                              </View>
                            </View>
                          ))}
                      </View>
                      {paymentHistory.length > 0 && (
                        <View style={styles.paymentHistory}>
                          <Text style={styles.paymentHistoryTitle}>Payment history</Text>
                          {paymentHistory.map((payment) => {
                            const paymentDate =
                              payment.billDate?.toDate() ?? payment.createdAt?.toDate();
                            return (
                              <View style={styles.paymentRow} key={payment.id}>
                                <Ionicons
                                  name="checkmark-circle-outline"
                                  size={15}
                                  color="#2E7D32"
                                />
                                <Text style={styles.paymentText}>
                                  {paymentDate ? paymentDateLabel(paymentDate) : "Date unavailable"}
                                </Text>
                                <Text style={styles.paymentAmount}>
                                  {currency(payment.amount ?? 0)}
                                </Text>
                                {!item.disabled && (
                                  <TouchableOpacity
                                    style={styles.editPaymentButton}
                                    onPress={() => openPaymentEditor(item.contactId, payment)}
                                  >
                                    <Ionicons name="create-outline" size={17} color="#1B5E20" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                      {!item.disabled && (
                        <TouchableOpacity
                          style={styles.receiveButton}
                          onPress={() => {
                            setReceiveContact(item);
                            setDirection(item.rentDirection ?? "received");
                            setReceiveDate(new Date());
                            setShowReceiveForm(true);
                          }}
                        >
                          <Ionicons name="arrow-down-circle-outline" size={19} color="#FFFFFF" />
                          <Text style={styles.receiveButtonText}>
                            Record {item.rentDirection === "given" ? "given" : "received"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <TouchableOpacity style={styles.configureButton} onPress={() => openForm(item)}>
                      <Text style={styles.configureText}>Configure monthly amount</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            );
          }}
        />
      )}
      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedContact ? "Edit rent contact" : "Add rent contact"}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Contact name"
              value={contactName}
              onChangeText={setContactName}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone (optional)"
              keyboardType="phone-pad"
              value={contactPhone}
              onChangeText={setContactPhone}
            />
            <Text style={styles.fieldLabel}>Monthly calculation</Text>
            <Text style={styles.fieldLabel}>Direction</Text>
            <View style={styles.modeRow}>
              {(["received", "given"] as RentDirection[]).map((option) => (
                <TouchableOpacity
                  key={option}
                  disabled={Boolean(selectedContact)}
                  style={[
                    styles.modeButton,
                    direction === option && styles.modeSelected,
                    selectedContact && styles.disabledInput,
                  ]}
                  onPress={() => setDirection(option)}
                >
                  <Text style={[styles.modeText, direction === option && styles.modeSelectedText]}>
                    {option === "received" ? "Received monthly" : "Given monthly"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modeRow}>
              {(["rent", "interest"] as RentMode[]).map((option) => (
                <TouchableOpacity
                  key={option}
                  disabled={Boolean(selectedContact)}
                  style={[
                    styles.modeButton,
                    mode === option && styles.modeSelected,
                    selectedContact && styles.disabledInput,
                  ]}
                  onPress={() => setMode(option)}
                >
                  <Text style={[styles.modeText, mode === option && styles.modeSelectedText]}>
                    {option === "rent" ? "Fixed rent" : "Interest %"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {mode === "rent" ? (
              <TextInput
                style={[styles.input, selectedContact && styles.disabledInput]}
                editable={!selectedContact}
                placeholder="Rent amount per month"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            ) : (
              <>
                <TextInput
                  style={[styles.input, selectedContact && styles.disabledInput]}
                  editable={!selectedContact}
                  placeholder="Principal amount"
                  keyboardType="decimal-pad"
                  value={principal}
                  onChangeText={setPrincipal}
                />
                <TextInput
                  style={[styles.input, selectedContact && styles.disabledInput]}
                  editable={!selectedContact}
                  placeholder="Interest percentage per month"
                  keyboardType="decimal-pad"
                  value={rate}
                  onChangeText={setRate}
                />
              </>
            )}
            <TouchableOpacity
              disabled={Boolean(selectedContact)}
              style={[styles.dateButton, selectedContact && styles.disabledInput]}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={19} color="#2E7D32" />
              <View style={styles.dateText}>
                <Text style={styles.dateLabel}>Start month</Text>
                <Text style={styles.dateValue}>{monthLabel(startDate)}</Text>
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
              <Ionicons name="calendar-outline" size={19} color="#C0392B" />
              <View style={styles.dateText}>
                <Text style={styles.dateLabel}>End rent service</Text>
                <Text style={styles.dateValue}>
                  {endDate ? endDate.toLocaleDateString("en-IN") : "No end date"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#718174" />
            </TouchableOpacity>
            {endDate && (
              <TouchableOpacity style={styles.clearDateButton} onPress={() => setEndDate(null)}>
                <Text style={styles.clearDateText}>Clear end date</Text>
              </TouchableOpacity>
            )}
            {showEndDatePicker && (
              <DateTimePicker
                value={endDate ?? new Date()}
                mode="date"
                display="default"
                onChange={(event: DateTimePickerEvent, selected?: Date) => {
                  setShowEndDatePicker(false);
                  if (selected) setEndDate(selected);
                }}
              />
            )}
            <Text style={styles.helper}>
              The monthly amount is added automatically. Payments marked as{" "}
              {direction === "given" ? "given" : "received"} reduce that month’s balance.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              {selectedContact && (
                <TouchableOpacity
                  style={styles.disableButton}
                  onPress={() =>
                    Alert.alert(
                      "Disable contact?",
                      "This contact will be hidden from Rent unless disabled contacts are shown in the filter.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Disable",
                          style: "destructive",
                          onPress: () => void disableRentContact(),
                        },
                      ],
                    )
                  }
                  disabled={saving}
                >
                  <Text style={styles.disableText}>Disable contact</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => void saveConfiguration()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showReceiveForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReceiveForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Record {direction === "given" ? "given" : "received"}
            </Text>
            <Text style={styles.fieldLabel}>{receiveContact?.name}</Text>
            <TextInput
              style={styles.input}
              placeholder={`Amount ${direction === "given" ? "given" : "received"}`}
              keyboardType="decimal-pad"
              value={receiveAmount}
              onChangeText={setReceiveAmount}
              autoFocus
            />
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowReceiveDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={19} color="#2E7D32" />
              <View style={styles.dateText}>
                <Text style={styles.dateLabel}>Payment date</Text>
                <Text style={styles.dateValue}>{receiveDate.toLocaleDateString("en-IN")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#718174" />
            </TouchableOpacity>
            {showReceiveDatePicker && (
              <DateTimePicker
                value={receiveDate}
                mode="date"
                display="default"
                onChange={(event: DateTimePickerEvent, selected?: Date) => {
                  setShowReceiveDatePicker(false);
                  if (selected) setReceiveDate(selected);
                }}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowReceiveForm(false)}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => void recordReceived()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={editingPayment !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingPayment(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Edit {direction === "given" ? "given" : "received"} payment
            </Text>
            <TextInput
              style={styles.input}
              placeholder={`Amount ${direction === "given" ? "given" : "received"}`}
              keyboardType="decimal-pad"
              value={editAmount}
              onChangeText={setEditAmount}
              autoFocus
            />
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowEditDatePicker(true)}>
              <Ionicons name="calendar-outline" size={19} color="#2E7D32" />
              <View style={styles.dateText}>
                <Text style={styles.dateLabel}>Payment date</Text>
                <Text style={styles.dateValue}>{editDate.toLocaleDateString("en-IN")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#718174" />
            </TouchableOpacity>
            {showEditDatePicker && (
              <DateTimePicker
                value={editDate}
                mode="date"
                display="default"
                onChange={(event: DateTimePickerEvent, selected?: Date) => {
                  setShowEditDatePicker(false);
                  if (selected) setEditDate(selected);
                }}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingPayment(null)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => void updateReceivedPayment()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
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
  container: { flex: 1, backgroundColor: "#F7FAF7" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconButton: { padding: 4 },
  filterMenu: {
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EAE1",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterLabel: { color: "#364439", fontWeight: "600" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EAE1",
    borderRadius: 12,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { color: "#27352A", fontSize: 16, fontWeight: "700" },
  summaryDue: { color: "#C0392B" },
  summaryReceived: { color: "#2E7D32" },
  summaryLabel: { color: "#718174", fontSize: 11, marginTop: 4 },
  title: { fontSize: 24, fontWeight: "700", color: "#17351D" },
  subtitle: { color: "#718174", marginTop: 4 },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: "center", color: "#718174", marginTop: 48, lineHeight: 22 },
  contactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E1EAE1",
  },
  contactHeader: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#DCEBDD",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#1B5E20", fontWeight: "700", fontSize: 18 },
  contactInfo: { flex: 1, marginLeft: 12 },
  nameStatusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  contactName: { fontSize: 17, fontWeight: "700", color: "#18231A" },
  disabledBadge: {
    color: "#FFFFFF",
    backgroundColor: "#8A8F8A",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  contactMode: { color: "#718174", marginTop: 3 },
  expandButton: { marginLeft: 14, padding: 2 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EDF1ED",
  },
  totalLabel: { color: "#718174", fontSize: 12, marginBottom: 4 },
  totalValue: { color: "#27352A", fontWeight: "700" },
  due: { color: "#C0392B", fontWeight: "700" },
  partial: { color: "#B7791F", fontWeight: "700" },
  received: { color: "#2E7D32", fontWeight: "700" },
  monthList: { marginTop: 12 },
  monthBlock: { borderBottomWidth: 1, borderBottomColor: "#F0F3F0" },
  monthRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3F0",
  },
  paymentHistory: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EDF1ED" },
  paymentHistoryTitle: { color: "#536256", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  paymentRow: { flexDirection: "row", alignItems: "center", paddingBottom: 8, paddingLeft: 4 },
  paymentText: { flex: 1, color: "#718174", fontSize: 12, marginLeft: 5 },
  paymentAmount: { color: "#2E7D32", fontSize: 12, fontWeight: "700" },
  editPaymentButton: { paddingLeft: 12, paddingVertical: 2 },
  monthLabel: { flex: 1, color: "#364439" },
  monthAmount: { width: 86, color: "#364439", textAlign: "right" },
  monthStatus: { width: 78, textAlign: "right", fontSize: 12 },
  receiveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2E7D32",
    paddingVertical: 11,
    borderRadius: 9,
    marginTop: 14,
  },
  receiveButtonText: { color: "#FFFFFF", fontWeight: "700" },
  configureButton: {
    borderWidth: 1,
    borderColor: "#2E7D32",
    borderRadius: 9,
    padding: 11,
    alignItems: "center",
    marginTop: 16,
  },
  configureText: { color: "#2E7D32", fontWeight: "700" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 18, color: "#18231A" },
  fieldLabel: { color: "#718174", marginBottom: 8 },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD8CC",
    borderRadius: 8,
    padding: 11,
    alignItems: "center",
  },
  modeSelected: { backgroundColor: "#E1F0E2", borderColor: "#2E7D32" },
  modeText: { color: "#536256" },
  modeSelectedText: { color: "#1B5E20", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#CBD8CC",
    borderRadius: 8,
    padding: 13,
    marginBottom: 10,
    color: "#18231A",
  },
  disabledInput: { backgroundColor: "#F0F2F0", borderColor: "#D8DED8", opacity: 0.7 },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD8CC",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  dateText: { flex: 1, marginLeft: 10 },
  dateLabel: { color: "#718174", fontSize: 12 },
  dateValue: { color: "#18231A", marginTop: 3, fontWeight: "600" },
  clearDateButton: { alignSelf: "flex-end", marginTop: -4, marginBottom: 10 },
  clearDateText: { color: "#C0392B", fontSize: 12, fontWeight: "600" },
  helper: { color: "#718174", fontSize: 12, lineHeight: 18, marginTop: 2 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  cancelButton: { padding: 12 },
  saveButton: {
    backgroundColor: "#2E7D32",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveText: { color: "#FFFFFF", fontWeight: "700" },
  disableButton: {
    borderWidth: 1,
    borderColor: "#C0392B",
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: 8,
  },
  disableText: { color: "#C0392B", fontWeight: "700" },
});
