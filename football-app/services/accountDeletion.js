import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

import { auth, db } from "./firebase";
import { removeProfilePhoto } from "./profilePhoto";

const LOCAL_ACCOUNT_KEYS = [
  "notification_settings",
  "expo_push_token",
];

async function deleteSnapshots(snapshots) {
  const documents = snapshots.flatMap((snapshot) => snapshot.docs);

  for (let index = 0; index < documents.length; index += 400) {
    const batch = writeBatch(db);

    documents.slice(index, index + 400).forEach((item) => {
      batch.delete(item.ref);
    });

    await batch.commit();
  }
}

async function deleteAssociatedFirestoreData(userId) {
  const ownedQueries = [
    query(collectionGroup(db, "messages"), where("userId", "==", userId)),
    query(collectionGroup(db, "pollVotes"), where("userId", "==", userId)),
    query(collection(db, "reports"), where("reporterId", "==", userId)),
    query(collection(db, "feedback"), where("userId", "==", userId)),
  ];

  const [ownedSnapshots, blockedSnapshot] = await Promise.all([
    Promise.all(ownedQueries.map((ownedQuery) => getDocs(ownedQuery))),
    getDocs(collection(db, "users", userId, "blocked")),
  ]);

  await deleteSnapshots([...ownedSnapshots, blockedSnapshot]);
  await deleteDoc(doc(db, "users", userId));
}

export function usesPasswordSignIn(user) {
  return Boolean(
    user?.providerData?.some(
      (provider) => provider.providerId === "password"
    )
  );
}

export async function deleteCurrentAccount(password) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Sign in before deleting your account.");
  }

  if (usesPasswordSignIn(user)) {
    if (!password) {
      throw new Error("Enter your password to confirm deletion.");
    }

    const credential = EmailAuthProvider.credential(
      user.email,
      password
    );
    await reauthenticateWithCredential(user, credential);
  }

  await deleteAssociatedFirestoreData(user.uid);
  await removeProfilePhoto(user.uid);
  await AsyncStorage.multiRemove(LOCAL_ACCOUNT_KEYS);
  await deleteUser(user);
}
