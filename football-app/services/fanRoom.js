import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { FAN_TERMS_VERSION } from "../constants/legal";
import { auth, db } from "./firebase";

const BLOCKED_TEXT_PATTERNS = [
  /\bkill yourself\b/i,
  /\bnazi\b/i,
  /\bterrorist threat\b/i,
  /\bsexual content\b/i,
];

function roomCollection(matchId, child) {
  return collection(
    db,
    "watchRooms",
    String(matchId),
    child
  );
}

function currentUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Sign in from Profile before joining the Fan Room.");
  }

  return user;
}

function validateMessage(text) {
  const cleanText = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

  if (!cleanText) {
    throw new Error("Write a message first.");
  }

  if (BLOCKED_TEXT_PATTERNS.some((pattern) => pattern.test(cleanText))) {
    throw new Error(
      "That message conflicts with the MatchZone community rules."
    );
  }

  return cleanText;
}

export async function hasAcceptedFanTerms(userId) {
  if (!userId) return false;

  const snapshot = await getDoc(doc(db, "users", userId));
  return snapshot.data()?.fanTermsVersion === FAN_TERMS_VERSION;
}

export async function acceptFanTerms() {
  const user = currentUser();

  await setDoc(
    doc(db, "users", user.uid),
    {
      fanTermsVersion: FAN_TERMS_VERSION,
      fanTermsAcceptedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeToBlockedUsers(onBlockedUsers, onError) {
  const user = auth.currentUser;

  if (!user) {
    onBlockedUsers(new Set());
    return () => {};
  }

  return onSnapshot(
    collection(db, "users", user.uid, "blocked"),
    (snapshot) => {
      onBlockedUsers(new Set(snapshot.docs.map((item) => item.id)));
    },
    onError
  );
}

export function subscribeToFanMessages(
  matchId,
  onMessages,
  onError
) {
  const messagesQuery = query(
    roomCollection(matchId, "messages"),
    orderBy("createdAt", "desc"),
    limit(40)
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      onMessages(
        snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .filter((item) => item.status !== "removed")
          .reverse()
      );
    },
    onError
  );
}

export async function sendFanMessage(matchId, text) {
  const user = currentUser();
  const cleanText = validateMessage(text);

  if (!(await hasAcceptedFanTerms(user.uid))) {
    throw new Error("Accept the community rules before posting.");
  }

  await addDoc(roomCollection(matchId, "messages"), {
    text: cleanText,
    userId: user.uid,
    status: "visible",
    createdAt: serverTimestamp(),
  });
}

export async function reportFanMessage(matchId, message, reason) {
  const user = currentUser();

  if (!message?.id || !message?.userId) {
    throw new Error("This message cannot be reported.");
  }

  await addDoc(collection(db, "reports"), {
    type: "fan_message",
    matchId: String(matchId),
    messageId: String(message.id),
    reportedUserId: String(message.userId),
    reporterId: user.uid,
    reason: String(reason || "Objectionable content").slice(0, 120),
    status: "new",
    createdAt: serverTimestamp(),
  });
}

export async function blockFanUser(userId) {
  const user = currentUser();

  if (!userId || userId === user.uid) {
    throw new Error("This user cannot be blocked.");
  }

  await setDoc(
    doc(db, "users", user.uid, "blocked", String(userId)),
    {
      blockedUserId: String(userId),
      createdAt: serverTimestamp(),
    }
  );
}

export function subscribeToFanPoll(
  matchId,
  onPoll,
  onError
) {
  return onSnapshot(
    roomCollection(matchId, "pollVotes"),
    (snapshot) => {
      const counts = {
        home: 0,
        draw: 0,
        away: 0,
      };

      snapshot.docs.forEach((item) => {
        const choice = item.data()?.choice;

        if (counts[choice] != null) {
          counts[choice] += 1;
        }
      });

      onPoll({
        counts,
        total: snapshot.size,
        userChoice:
          snapshot.docs.find(
            (item) => item.id === auth.currentUser?.uid
          )?.data()?.choice || null,
      });
    },
    onError
  );
}

export async function voteInFanPoll(matchId, choice) {
  const user = currentUser();

  if (!["home", "draw", "away"].includes(choice)) {
    throw new Error("Invalid poll option.");
  }

  if (!(await hasAcceptedFanTerms(user.uid))) {
    throw new Error("Accept the community rules before voting.");
  }

  await setDoc(
    doc(
      db,
      "watchRooms",
      String(matchId),
      "pollVotes",
      user.uid
    ),
    {
      userId: user.uid,
      choice,
      updatedAt: serverTimestamp(),
    }
  );
}
