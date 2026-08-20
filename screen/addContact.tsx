import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  StatusBar,
} from "react-native";
import * as Contacts from "expo-contacts";
import { Ionicons } from "@expo/vector-icons";

type ContactListItem = {
  id: string;
  name: string;
  phone: string;
  image: boolean;
  color: string;
  warning: boolean;
};

type HeaderProps = {
  onBack: () => void;
  onSearch: () => void;
};

type ContactRowProps = {
  item: ContactListItem;
  onPress: (contact: ContactListItem) => void;
};

/* // ---- Mock Data ----
const contacts = [
  { id: '1', name: 'AMARAN......', phone: '9789026803', warning: true, image: null, color: '#B0B0B0' },
  { id: '2', name: 'A\\c.no-ariy', phone: '6106192020', warning: false, image: null, color: '#B0B0B0' },
  { id: '3', name: 'Aathavan Fridge Service', phone: '9940433774', warning: false, image: 'photo', color: '#4A5568' },
  { id: '4', name: 'Abdul Softsuave', phone: '7010860850', warning: false, image: 'photo', color: '#8B4513' },
  { id: '5', name: 'Abdul Softsuave', phone: '9543123141', warning: false, image: 'photo', color: '#8B4513' },
  { id: '6', name: 'Ac Service', phone: '8098077839', warning: false, image: 'photo', color: '#2F855A' },
  { id: '7', name: 'Acko', phone: '8072768986', warning: false, image: null, color: '#B0B0B0' },
  { id: '8', name: 'Adhira S', phone: '8122548773', warning: false, image: 'photo', color: '#C53030' },
  { id: '9', name: 'Ajax Ws', phone: '8608840417', warning: false, image: null, color: '#B0B0B0' },
  { id: '10', name: 'Akbar Ctg Cab', phone: '9840604659', warning: false, image: null, color: '#B0B0B0' },
  { id: '11', name: 'Alex Ss', phone: '7395850735', warning: false, image: 'photo', color: '#4A5568' },
  { id: '12', name: 'Alex Ss', phone: '', warning: false, image: 'photo', color: '#4A5568' },
]; */

// ---- Avatar ----
const Avatar = ({ contact }: { contact: ContactListItem }) => {
  if (contact.image) {
    // Replace with <Image source={{ uri: contact.imageUrl }} style={styles.avatarImg} />
    return (
      <View
        style={[
          styles.avatarImg,
          {
            backgroundColor: contact.color,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Text style={styles.avatarInitial}>{contact.name.charAt(0).toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <View style={styles.avatarPlaceholder}>
      <Ionicons name="person-outline" size={22} color="#FFFFFF" />
    </View>
  );
};

// ---- Contact Row ----
const ContactRow = ({ item, onPress }: ContactRowProps) => (
  <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={() => onPress(item)}>
    <Avatar contact={item} />
    <View style={styles.rowContent}>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.warning && (
          <Ionicons name="warning-outline" size={15} color="#F5A623" style={{ marginLeft: 6 }} />
        )}
      </View>
      {!!item.phone && <Text style={styles.phone}>{item.phone}</Text>}
    </View>
  </TouchableOpacity>
);

// ---- Header ----
const Header = ({ onBack, onSearch }: HeaderProps) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>Add Customer</Text>
    <TouchableOpacity onPress={onSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="search-outline" size={20} color="#1A1A1A" />
    </TouchableOpacity>
  </View>
);

// ---- Main Screen ----
export default function AddCustomerScreen({ navigation }: { navigation?: { goBack: () => void } }) {
  const [searchVisible, setSearchVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const filteredContacts = contacts.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query),
  );

  const syncContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();

    if (status === "granted") {
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Image,
        ],
      });

      if (data.length > 0) {
        setContacts(
          data.map((contact, index) => ({
            id: contact.id ?? String(index),
            name: contact.name ?? "Unnamed contact",
            phone: contact.phoneNumbers?.[0]?.number ?? "",
            image: Boolean(contact.image),
            color: "#B0B0B0",
            warning: false,
          })),
        );
      }
    }
  };

  useEffect(() => {
    const contactSyncTimeout = setTimeout(() => {
      void syncContacts();
    }, 0);

    return () => clearTimeout(contactSyncTimeout);
  }, []);

  const handleSelectContact = (contact: ContactListItem) => {
    // navigate to customer detail / confirm screen
    console.log("Selected contact:", contact);
  };

  const handleAddManually = () => {
    // navigate to manual add form
    console.log("Add manually pressed");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <Header onBack={() => navigation?.goBack()} onSearch={() => setSearchVisible((v) => !v)} />

      {searchVisible && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color="#999" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts"
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close" size={16} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>Phonebook Contacts</Text>
      </View>

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ContactRow item={item} onPress={handleSelectContact} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={handleAddManually}>
        <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
        <Text style={styles.fabText}>Add Manually</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F2",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1A1A1A",
    padding: 0,
  },
  sectionLabelWrap: {
    backgroundColor: "#F2F7F4",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#C4C4C4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 14,
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  rowContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 15.5,
    fontWeight: "600",
    color: "#1A1A1A",
    flexShrink: 1,
  },
  phone: {
    fontSize: 13,
    color: "#4A9B7F",
    marginTop: 3,
  },
  separator: {
    height: 1,
    backgroundColor: "#E8E8E8",
    marginLeft: 72,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E7D32",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  fabText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
    marginLeft: 8,
  },
});
