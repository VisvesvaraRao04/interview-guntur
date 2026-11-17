import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, collection, onSnapshot, doc, runTransaction, setDoc, getDoc, updateDoc, addDoc, query, where, getDocs, writeBatch } from "firebase/firestore";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAbo12Xq-6oNbXpHRJaAy4S6AGfKHloAl4",
  authDomain: "test1-a7e7a.firebaseapp.com",
  projectId: "test1-a7e7a",
  storageBucket: "test1-a7e7a.firebasestorage.app",
  messagingSenderId: "300834701767",
  appId: "1:300834701767:web:9c99de6d5a4a118bfe19e2",
  measurementId: "G-28K6P4NM7X",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const watchAuth = (callback) => onAuthStateChanged(auth, callback);
export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const registerUser = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const logoutUser = () => signOut(auth);
export async function changeUserPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Please sign in again before changing your password.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}
export const saveUserProfile = (uid, profile) => setDoc(doc(db, "users", uid), { ...profile, createdAt: new Date() }, { merge: true });
export async function getCandidateProfileByEmail(email) {
  const snapshot = await getDocs(query(collection(db, "users"), where("email", "==", String(email))));
  return snapshot.docs[0]?.data() || null;
}
export async function getUserProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", String(uid)));
  return snapshot.exists() ? snapshot.data() : null;
}

export function subscribeToSlots(onChange, onError) {
  return onSnapshot(collection(db, "interviewSlots"), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}
export async function getSlotsOnce() {
  const snapshot = await (await import("firebase/firestore")).getDocs(collection(db, "interviewSlots"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
export function subscribeToCandidateBooking(candidateId, onChange, onError) {
  return onSnapshot(doc(db, "candidateBookings", String(candidateId)), (snapshot) => onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), onError);
}
export function subscribeToCandidateBookings(candidateId, onChange, onError) {
  return onSnapshot(query(collection(db, "candidateBookings"), where("candidateId", "==", String(candidateId))), (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}
export function subscribeToBookings(onChange, onError) {
  return onSnapshot(collection(db, "bookings"), (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}
export function subscribeToSlotReservations(onChange, onError) {
  return onSnapshot(collection(db, "slotReservations"), (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}
const slotReservationRef = (slotId, startTime) => startTime
  ? doc(db, "slotReservations", `${String(slotId)}_${String(startTime).replaceAll(":", "-")}`)
  : null;

export async function bookSlot(slotId, candidateId = "candidate", selectedStartTime = "", selectedEndTime = "") {
  const slotRef = doc(db, "interviewSlots", String(slotId));
  const bookingRef = doc(collection(db, "bookings"));
  const candidateRef = doc(db, "candidateBookings", `${candidateId}_${slotId}`);
  const reservationRef = slotReservationRef(slotId, selectedStartTime);
  const bookingDate = new Date();
  return runTransaction(db, async (transaction) => {
    const [existing, snapshot, reservation] = await Promise.all([transaction.get(candidateRef), transaction.get(slotRef), reservationRef ? transaction.get(reservationRef) : Promise.resolve(null)]);
    if (existing.exists()) throw new Error("You already booked this interview");
    if (reservation?.exists()) throw new Error("This interview time was just booked. Please choose another time.");
    if (!snapshot.exists()) throw new Error("This interview window is no longer available. Refresh and choose another.");
    const slot = snapshot.data();
    const seats = Number(slot.seats ?? slot.availableSeats ?? 0);
    if (seats <= 0) throw new Error("This interview window is full");
    const nextSeats = seats - 1;
    const status = nextSeats === 0 ? "Full" : "Available";
    const booking = { slotId: String(slotId), candidateId, selectedStartTime, selectedEndTime, status: "booked", bookingDate };
    transaction.update(slotRef, { seats: nextSeats, availableSeats: nextSeats, status, updatedAt: bookingDate });
    transaction.set(bookingRef, booking);
    transaction.set(candidateRef, { ...booking, bookingId: bookingRef.id });
    if (reservationRef) transaction.set(reservationRef, { slotId: String(slotId), selectedStartTime, selectedEndTime, status: "booked", updatedAt: bookingDate });
    return { ...slot, id: slotId, seats: nextSeats, availableSeats: nextSeats, status };
  });
}

export async function cancelCandidateBooking(booking) {
  const candidateId = String(booking.candidateId || auth.currentUser?.email || "candidate");
  const slotRef = doc(db, "interviewSlots", String(booking.slotId));
  const candidateRef = doc(db, "candidateBookings", String(booking.id));
  const bookingRef = booking.bookingId ? doc(db, "bookings", String(booking.bookingId)) : null;
  const reservationRef = slotReservationRef(booking.slotId, booking.selectedStartTime);
  await runTransaction(db, async (transaction) => {
    const slotSnapshot = await transaction.get(slotRef);
    const latestRef = doc(db, "candidateBookings", candidateId);
    const latestSnapshot = latestRef.path !== candidateRef.path ? await transaction.get(latestRef) : null;
    const reservationSnapshot = reservationRef ? await transaction.get(reservationRef) : null;
    if (slotSnapshot.exists()) {
      const slot = slotSnapshot.data();
      const capacity = Number(slot.capacity ?? 0);
      const seats = Number(slot.seats ?? slot.availableSeats ?? 0);
      const nextSeats = capacity ? Math.min(capacity, seats + 1) : seats + 1;
      transaction.update(slotRef, { seats: nextSeats, availableSeats: nextSeats, status: "Available", updatedAt: new Date() });
    }
    transaction.delete(candidateRef);
    if (bookingRef) transaction.delete(bookingRef);
    if (reservationSnapshot?.exists()) transaction.delete(reservationRef);
    if (latestSnapshot?.exists() && latestSnapshot.data().bookingId === booking.bookingId) transaction.delete(latestRef);
  });
}

export async function rescheduleCandidateBooking(booking, nextSlot, selectedStartTime, selectedEndTime) {
  const candidateId = String(booking.candidateId || auth.currentUser?.email || "candidate");
  const oldSlotRef = doc(db, "interviewSlots", String(booking.slotId));
  const nextSlotRef = doc(db, "interviewSlots", String(nextSlot.id));
  const candidateRef = doc(db, "candidateBookings", String(booking.id));
  const oldReservationRef = slotReservationRef(booking.slotId, booking.selectedStartTime);
  const nextReservationRef = slotReservationRef(nextSlot.id, selectedStartTime);
  if (!booking.bookingId) throw new Error("This booking cannot be rescheduled because its booking record is unavailable.");
  const bookingRef = doc(db, "bookings", String(booking.bookingId));
  const latestRef = doc(db, "candidateBookings", candidateId);
  await runTransaction(db, async (transaction) => {
    const oldSnapshot = await transaction.get(oldSlotRef);
    const nextSnapshot = oldSlotRef.path === nextSlotRef.path ? oldSnapshot : await transaction.get(nextSlotRef);
    const candidateSnapshot = await transaction.get(candidateRef);
    const bookingSnapshot = await transaction.get(bookingRef);
    const latestSnapshot = await transaction.get(latestRef);
    const oldReservationSnapshot = oldReservationRef ? await transaction.get(oldReservationRef) : null;
    const nextReservationSnapshot = nextReservationRef && nextReservationRef.path !== oldReservationRef?.path ? await transaction.get(nextReservationRef) : oldReservationSnapshot;
    if (!candidateSnapshot.exists() || !bookingSnapshot.exists()) throw new Error("This booking is no longer available.");
    if (!nextSnapshot.exists()) throw new Error("That interview window no longer exists.");
    if (nextReservationSnapshot?.exists() && nextReservationRef?.path !== oldReservationRef?.path) throw new Error("That interview time was just booked. Choose another time.");
    if (oldSlotRef.path !== nextSlotRef.path) {
      const next = nextSnapshot.data();
      const seats = Number(next.seats ?? next.availableSeats ?? 0);
      if (seats < 1) throw new Error("That interview window is full. Choose another time.");
      transaction.update(nextSlotRef, { seats: seats - 1, availableSeats: seats - 1, status: seats === 1 ? "Full" : "Available", updatedAt: new Date() });
      if (oldSnapshot.exists()) {
        const old = oldSnapshot.data();
        const capacity = Number(old.capacity ?? 0);
        const oldSeats = Number(old.seats ?? old.availableSeats ?? 0);
        const released = capacity ? Math.min(capacity, oldSeats + 1) : oldSeats + 1;
        transaction.update(oldSlotRef, { seats: released, availableSeats: released, status: "Available", updatedAt: new Date() });
      }
    }
    const changes = { slotId: String(nextSlot.id), selectedStartTime, selectedEndTime, status: "booked", updatedAt: new Date() };
    transaction.update(candidateRef, changes);
    transaction.update(bookingRef, changes);
    if (oldReservationRef && oldReservationRef.path !== nextReservationRef?.path && oldReservationSnapshot?.exists()) transaction.delete(oldReservationRef);
    if (nextReservationRef) transaction.set(nextReservationRef, { slotId: String(nextSlot.id), selectedStartTime, selectedEndTime, status: "booked", updatedAt: new Date() });
    if (latestSnapshot.exists() && latestSnapshot.data().bookingId === booking.bookingId) transaction.update(latestRef, changes);
  });
}

export async function seedSlotsToFirebase(slots) {
  await Promise.all(slots.map(({ id, ...slot }) => setDoc(doc(db, "interviewSlots", String(id)), { ...slot, availableSeats: slot.seats, updatedAt: new Date() }, { merge: true })));
}

export async function createSlotInFirebase(slot) {
  const ref = doc(collection(db, "interviewSlots"));
  await setDoc(ref, { ...slot, seats: Number(slot.capacity), availableSeats: Number(slot.capacity), status: "Available", createdAt: new Date() });
  return ref.id;
}

export async function updateSlotInFirebase(slotId, changes) {
  const slotRef = doc(db, "interviewSlots", String(slotId));
  const [snapshot, reservationSnapshot] = await Promise.all([
    getDoc(slotRef),
    getDocs(query(collection(db, "slotReservations"), where("slotId", "==", String(slotId)))),
  ]);
  if (!snapshot.exists()) throw new Error("This interview slot no longer exists.");
  const old = snapshot.data();
  const oldCapacity = Number(old.capacity ?? 0);
  const booked = Math.max(0, oldCapacity - Number(old.seats ?? old.availableSeats ?? 0));
  const capacity = Number(changes.capacity);
  if (capacity < booked) throw new Error(`Capacity cannot be lower than the ${booked} seats already booked.`);
  const timeChanged = changes.date !== old.date || changes.startTime !== old.startTime || changes.endTime !== old.endTime || Number(changes.durationMinutes) !== Number(old.durationMinutes);
  if (reservationSnapshot.size && timeChanged) throw new Error("This slot has booked times. Remove its bookings before changing the date or time window.");
  const seats = capacity - booked;
  await updateDoc(slotRef, { ...changes, capacity, seats, availableSeats: seats, status: seats > 0 ? "Available" : "Full", updatedAt: new Date() });
}

export async function deleteSlotInFirebase(slotId) {
  const slotRef = doc(db, "interviewSlots", String(slotId));
  const [bookings, candidateBookings, reservations] = await Promise.all([
    getDocs(query(collection(db, "bookings"), where("slotId", "==", String(slotId)))),
    getDocs(query(collection(db, "candidateBookings"), where("slotId", "==", String(slotId)))),
    getDocs(query(collection(db, "slotReservations"), where("slotId", "==", String(slotId)))),
  ]);
  const batch = writeBatch(db);
  bookings.docs.forEach(item => batch.update(item.ref, { status: "cancelled", updatedAt: new Date() }));
  candidateBookings.docs.forEach(item => batch.delete(item.ref));
  reservations.docs.forEach(item => batch.delete(item.ref));
  batch.delete(slotRef);
  await batch.commit();
}

// Analytics only works in supported browser environments, not in Node.js/SSR.
export const analytics = isSupported().then((supported) =>
  supported ? getAnalytics(app) : null,
);

export { firebaseConfig };
