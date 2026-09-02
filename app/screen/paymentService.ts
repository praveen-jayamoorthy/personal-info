import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

export type TransactionType = "given" | "received";

export interface PaymentTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  addedBy: string;
  note?: string;
  billDate?: Date | null;
  createdAt: Date | null;
}

interface PaymentTransactionDoc {
  type: TransactionType;
  amount: number;
  addedBy: string;
  note?: string;
  billDate?: FirebaseFirestoreTypes.Timestamp | null;
  createdAt: FirebaseFirestoreTypes.Timestamp | null;
}

export interface ContactSummary {
  contactId: string;
  name: string;
  balanceDue: number;
  updatedAt: Date | null;
}

interface ContactSummaryDoc {
  name: string;
  balanceDue: number;
  updatedAt: FirebaseFirestoreTypes.Timestamp | null;
}

const contactDocRef = (userId: string, contactId: string) =>
  firestore().collection("users").doc(userId).collection("contact").doc(contactId);

const transactionsColRef = (userId: string, contactId: string) =>
  contactDocRef(userId, contactId).collection("transactions");

const toPaymentTransaction = (
  snapshot: FirebaseFirestoreTypes.QueryDocumentSnapshot,
): PaymentTransaction => {
  const data = snapshot.data() as PaymentTransactionDoc;
  return {
    id: snapshot.id,
    type: data.type,
    amount: data.amount,
    addedBy: data.addedBy,
    note: data.note,
    billDate: data.billDate?.toDate() ?? null,
    createdAt: data.createdAt?.toDate() ?? null,
  };
};

const toContactSummary = (
  snapshot: FirebaseFirestoreTypes.DocumentSnapshot,
): ContactSummary | null => {
  if (!snapshot.exists) return null;
  const data = snapshot.data() as ContactSummaryDoc;
  return {
    contactId: snapshot.id,
    name: data.name,
    balanceDue: data.balanceDue,
    updatedAt: data.updatedAt?.toDate() ?? null,
  };
};

export async function addPaymentTransaction(
  userId: string,
  contactId: string,
  contactName: string,
  input: {
    type: TransactionType;
    amount: number;
    addedBy: string;
    note?: string;
    billDate?: Date | null;
  },
): Promise<string> {
  if (!userId || !contactId) {
    throw new Error("A signed-in user and contact are required.");
  }
  if (input.amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const contactRef = contactDocRef(userId, contactId);
  const transactionRef = transactionsColRef(userId, contactId).doc();
  const userRef = firestore().collection("users").doc(userId);
  const delta = input.type === "given" ? input.amount : -input.amount;

  await firestore().runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const savedContacts = userSnapshot.data()?.contact;
    const contacts = Array.isArray(savedContacts) ? savedContacts : [];
    const updatedContacts = contacts.map((contact) => {
      if (contact?.contactId !== contactId) return contact;

      return {
        ...contact,
        balanceDue: (typeof contact.balanceDue === "number" ? contact.balanceDue : 0) + delta,
        updatedAt: firestore.Timestamp.now(),
      };
    });

    transaction.set(transactionRef, {
      type: input.type,
      amount: input.amount,
      addedBy: input.addedBy,
      note: input.note ?? "",
      billDate: input.billDate ? firestore.Timestamp.fromDate(input.billDate) : null,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    transaction.set(
      contactRef,
      {
        name: contactName,
        balanceDue: firestore.FieldValue.increment(delta),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    transaction.set(userRef, { contact: updatedContacts }, { merge: true });
  });

  return transactionRef.id;
}

export async function getPaymentTransactions(
  userId: string,
  contactId: string,
): Promise<PaymentTransaction[]> {
  const snapshot = await transactionsColRef(userId, contactId).orderBy("createdAt", "asc").get();
  return snapshot.docs.map(toPaymentTransaction);
}

export function listenToPaymentTransactions(
  userId: string,
  contactId: string,
  onChange: (transactions: PaymentTransaction[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return transactionsColRef(userId, contactId)
    .orderBy("createdAt", "asc")
    .onSnapshot(
      (snapshot) => onChange(snapshot.docs.map(toPaymentTransaction)),
      (error) => onError?.(error),
    );
}

export async function getContactSummary(
  userId: string,
  contactId: string,
): Promise<ContactSummary | null> {
  return toContactSummary(await contactDocRef(userId, contactId).get());
}

export function listenToContactSummary(
  userId: string,
  contactId: string,
  onChange: (summary: ContactSummary | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return contactDocRef(userId, contactId).onSnapshot(
    (snapshot) => onChange(toContactSummary(snapshot)),
    (error) => onError?.(error),
  );
}

export function listenToAllContacts(
  userId: string,
  onChange: (contacts: ContactSummary[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return firestore()
    .collection("users")
    .doc(userId)
    .collection("contact")
    .orderBy("updatedAt", "desc")
    .onSnapshot(
      (snapshot) =>
        onChange(
          snapshot.docs
            .map(toContactSummary)
            .filter((item): item is ContactSummary => item !== null),
        ),
      (error) => onError?.(error),
    );
}

export async function deletePaymentTransaction(
  userId: string,
  contactId: string,
  transaction: PaymentTransaction,
): Promise<void> {
  const batch = firestore().batch();
  const contactRef = contactDocRef(userId, contactId);
  const transactionRef = transactionsColRef(userId, contactId).doc(transaction.id);
  const reversal = transaction.type === "given" ? -transaction.amount : transaction.amount;

  batch.delete(transactionRef);
  batch.update(contactRef, {
    balanceDue: firestore.FieldValue.increment(reversal),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
}
