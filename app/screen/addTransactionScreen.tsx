import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useLedger } from './useLedger';
import { TransactionType } from './paymentService';

const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

const formatDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const formatCurrency = (n: number) => `₹${n.toLocaleString('en-IN')}`;

type Operator = '+' | '-' | '×';

/**
 * Minimal running-total calculator: typing digits builds the current operand,
 * pressing +/-/× commits it against the running total, and = or Confirm
 * resolves the final number. This mirrors the reference screenshots'
 * calculator-style keypad without needing a full expression parser.
 */
function useCalculatorAmount() {
  const [display, setDisplay] = useState('0');
  const [runningTotal, setRunningTotal] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Operator | null>(null);
  const [justEvaluated, setJustEvaluated] = useState(false);

  const applyPending = (nextValue: number) => {
    if (runningTotal === null || pendingOp === null) return nextValue;
    switch (pendingOp) {
      case '+':
        return runningTotal + nextValue;
      case '-':
        return runningTotal - nextValue;
      case '×':
        return runningTotal * nextValue;
      default:
        return nextValue;
    }
  };

  const pressDigit = (digit: string) => {
    if (justEvaluated) {
      setDisplay(digit === '.' ? '0.' : digit);
      setJustEvaluated(false);
      return;
    }
    if (digit === '.' && display.includes('.')) return;
    setDisplay((prev) => (prev === '0' && digit !== '.' ? digit : prev + digit));
  };

  const pressBackspace = () => {
    setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  };

  const pressOperator = (op: Operator) => {
    const current = parseFloat(display) || 0;
    const total = applyPending(current);
    setRunningTotal(total);
    setPendingOp(op);
    setDisplay('0');
    setJustEvaluated(false);
  };

  const pressEquals = () => {
    const current = parseFloat(display) || 0;
    const total = applyPending(current);
    setRunningTotal(null);
    setPendingOp(null);
    setDisplay(String(total));
    setJustEvaluated(true);
  };

  /** The confirmed numeric amount, resolving any pending operation. */
  const amount = useMemo(() => {
    const current = parseFloat(display) || 0;
    return applyPending(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display, runningTotal, pendingOp]);

  const reset = () => {
    setDisplay('0');
    setRunningTotal(null);
    setPendingOp(null);
    setJustEvaluated(false);
  };

  return { display, pressDigit, pressBackspace, pressOperator, pressEquals, amount, reset };
}

export default function AddTransactionScreen() {
  const params = useLocalSearchParams<{
    contactId?: string;
    contactName?: string;
    type?: TransactionType;
  }>();
  const contactId = typeof params.contactId === 'string' ? params.contactId : '';
  const contactName = typeof params.contactName === 'string' ? params.contactName : 'Contact';
  const type: TransactionType = params.type === 'received' ? 'received' : 'given';
  const isGiven: boolean = type === 'given';

  const user = useAuthStore((state) => state.user);
  const userId = user?.uid ?? '';
  const currentUserName = user?.displayName ?? 'You';

  const { summary, recordPayment } = useLedger(userId, contactId, contactName, currentUserName);
  const balanceDue = summary?.balanceDue ?? 0;

  const { display, pressDigit, pressBackspace, pressOperator, pressEquals, amount, reset } =
    useCalculatorAmount();

  const [note, setNote] = useState('');
  const [billDate, setBillDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasAmount = amount > 0;

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // iOS keeps the picker open inline
    if (selected) setBillDate(selected);
  };

  const handleConfirm = async () => {
    if (!hasAmount) {
      Alert.alert('Enter an amount', 'Amount must be greater than zero.');
      return;
    }
    setSaving(true);
    try {
      await recordPayment(type as TransactionType, amount, note.trim() || undefined, billDate);
      router.back();
    } catch (err) {
      Alert.alert('Failed to save', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const keypadRows: (string | 'back')[][] = [
    ['1', '2', '3', 'back'],
    ['4', '5', '6', '×'],
    ['7', '8', '9', '-'],
    ['.', '0', '=', '+'],
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={hitSlop}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{contactName.charAt(0)}</Text>
        </View>
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.headerName}>{contactName}</Text>
          <Text
            style={[
              styles.balanceLabel,
              { color: balanceDue >= 0 ? '#2E7D32' : '#C0392B' },
            ]}
          >
            {formatCurrency(Math.abs(balanceDue))} {balanceDue >= 0 ? 'Advance' : 'Due'}
          </Text>
        </View>
      </View>

      {/* Amount display */}
      <View style={styles.amountSection}>
        <View style={styles.amountRow}>
          <Text style={styles.rupee}>₹</Text>
          <Text style={styles.amountText}>{display}</Text>
          <View style={styles.cursor} />
        </View>
        <View style={styles.amountUnderline} />
      </View>

      {/* Notes + Bill Date — revealed once an amount has been entered */}
      {hasAmount && (
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📄</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add Notes"
              placeholderTextColor="#7A8F89"
              value={note}
              onChangeText={setNote}
            />
            <Text style={styles.detailIcon}>🎤</Text>
          </View>

          <TouchableOpacity style={styles.detailRow} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.detailIcon}>📅</Text>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.billDateLabel}>Bill Date</Text>
              <Text style={styles.billDateValue}>{formatDate(billDate)}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={billDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={onDateChange}
            />
          )}
        </View>
      )}

      <View style={{ flex: 1 }} />

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            { backgroundColor: isGiven ? '#C0392B' : '#2E7D32', opacity: hasAmount ? 1 : 0.5 },
          ]}
          onPress={handleConfirm}
          disabled={!hasAmount || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.confirmCheck}>✓</Text>
              <Text style={styles.confirmText}>Confirm</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {keypadRows.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.keypadRow}>
            {row.map((key) => {
              const isBack = key === 'back';
              const isOperator = key === '+' || key === '-' || key === '×';
              const isEquals = key === '=';

              const onPress = () => {
                if (isBack) return pressBackspace();
                if (isEquals) return pressEquals();
                if (isOperator) return pressOperator(key as Operator);
                return pressDigit(key);
              };

              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.key,
                    isBack && styles.keyBack,
                    isOperator && styles.keyOperator,
                    isEquals && styles.keyEquals,
                  ]}
                  onPress={onPress}
                >
                  <Text style={styles.keyText}>{isBack ? '⌫' : key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backIcon: { fontSize: 22, marginRight: 14 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E9C9D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#7A3B54', fontWeight: '700' },
  headerName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  balanceLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  amountSection: { alignItems: 'center', marginTop: 28, paddingHorizontal: 24 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rupee: { fontSize: 30, fontWeight: '600', color: '#1A1A1A', marginRight: 2 },
  amountText: { fontSize: 34, fontWeight: '700', color: '#1A1A1A' },
  cursor: { width: 2, height: 30, backgroundColor: '#2E7D6B', marginLeft: 4 },
  amountUnderline: {
    height: 2,
    backgroundColor: '#2E7D6B',
    width: '55%',
    marginTop: 8,
  },

  detailsSection: { paddingHorizontal: 16, marginTop: 24 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF4F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  detailIcon: { fontSize: 16, color: '#3A6F63' },
  notesInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#1A1A1A' },
  billDateLabel: { fontSize: 11, color: '#7A8F89' },
  billDateValue: { fontSize: 14, color: '#1A1A1A', fontWeight: '600', marginTop: 2 },
  chevron: { fontSize: 20, color: '#7A8F89' },

  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 140,
  },
  confirmCheck: { color: '#fff', fontSize: 15, marginRight: 6, fontWeight: '700' },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  keypad: { paddingHorizontal: 8, paddingBottom: 8 },
  keypadRow: { flexDirection: 'row', marginBottom: 8 },
  key: {
    flex: 1,
    height: 56,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#EFF6F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBack: { backgroundColor: '#FBDCDC' },
  keyOperator: { backgroundColor: '#E3EFEB' },
  keyEquals: { backgroundColor: '#BFE3D3' },
  keyText: { fontSize: 20, fontWeight: '600', color: '#1A1A1A' },
});
