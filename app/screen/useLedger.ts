import { useEffect, useState, useCallback } from "react";
import {
  addPaymentTransaction,
  listenToPaymentTransactions,
  listenToContactSummary,
  listenToAllContacts,
  PaymentTransaction,
  ContactSummary,
  TransactionType,
} from "./paymentService";

interface UseLedgerResult {
  transactions: PaymentTransaction[];
  summary: ContactSummary | null;
  loading: boolean;
  error: string | null;
  recordPayment: (
    type: TransactionType,
    amount: number,
    note?: string,
    billDate?: Date | null,
  ) => Promise<void>;
}

/**
 * Subscribes to a contact's transactions + running balance in real time.
 * Works identically for both users viewing the same contact/chat thread —
 * whichever side calls recordPayment(), both listeners update instantly.
 */
export function useLedger(
  userId: string | null,
  contactId: string | null,
  contactName: string,
  currentUserName: string,
): UseLedgerResult {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [summary, setSummary] = useState<ContactSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !contactId) return;

    const unsubTx = listenToPaymentTransactions(
      userId,
      contactId,
      (txs: PaymentTransaction[]) => {
        setTransactions(txs);
        setLoading(false);
      },
      (err: Error) => {
        setError(err.message);
        setLoading(false);
      },
    );

    const unsubSummary = listenToContactSummary(
      userId,
      contactId,
      (s: ContactSummary | null) => setSummary(s),
      (err: Error) => setError(err.message),
    );

    return () => {
      unsubTx();
      unsubSummary();
    };
  }, [userId, contactId]);

  const recordPayment = useCallback(
    async (type: TransactionType, amount: number, note?: string, billDate?: Date | null) => {
      if (!userId || !contactId) return;
      try {
        await addPaymentTransaction(userId, contactId, contactName, {
          type,
          amount,
          addedBy: currentUserName,
          note,
          billDate,
        });
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    [userId, contactId, contactName, currentUserName],
  );

  return { transactions, summary, loading, error, recordPayment };
}

/**
 * Subscribes to the full contacts list for a user (for the ContactsList screen),
 * ordered by most recently updated.
 */
export function useAllContacts(userId: string | null) {
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const unsub = listenToAllContacts(
      userId,
      (list: ContactSummary[]) => {
        setContacts(list);
        setLoading(false);
      },
      (err: Error) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [userId]);

  return { contacts, loading, error };
}
