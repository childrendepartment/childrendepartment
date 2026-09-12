import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    updateProfile, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set,
    update, 
    onValue, 
    get,
    push, 
    remove 
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import {
    getStorage,
    ref as storageRef,
    uploadBytesResumable,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyBsMaPJEXjJt4pMtJYeuZB7m1J2RjARqrU",
    authDomain: "children-department-ab045.firebaseapp.com",
    databaseURL: "https://children-department-ab045-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "children-department-ab045",
    storageBucket: "children-department-ab045.firebasestorage.app",
    messagingSenderId: "284100421486",
    appId: "1:284100421486:web:fc56c486487099662b037f",
    measurementId: "G-NNTTMWCQKK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export async function writeUserDataToDatabase(user, customData = {}) {
    const userRef = ref(db, 'users/' + user.uid);
    const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || customData.name || '',
        photoURL: user.photoURL || '',
        lastLoginAt: new Date().toISOString(),
        ...customData
    };
    return update(userRef, userData);
}

export async function updateUserStreak(user) {
    if (!user?.uid) {
        throw new Error('User is required to update streak');
    }

    const today = new Date();
    const todayDate = `${today.getFullYear().toString().padStart(4, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    const userRef = ref(db, 'users/' + user.uid);

    const snapshot = await get(userRef);
    const userData = snapshot.val() || {};
    const currentStreak = Number(userData.streak || 0);
    const lastVisit = userData.lastVisitAt ? new Date(userData.lastVisitAt) : null;
    let newStreak = 1;

    if (lastVisit) {
        const todayMidnight = new Date(today);
        const lastVisitMidnight = new Date(lastVisit);
        todayMidnight.setHours(0, 0, 0, 0);
        lastVisitMidnight.setHours(0, 0, 0, 0);

        const diffMs = todayMidnight - lastVisitMidnight;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            newStreak = currentStreak + 1;
        } else if (diffDays === 0) {
            newStreak = currentStreak;
        }
    }

    const updateData = {
        streak: newStreak,
        lastVisitAt: todayDate
    };

    await update(userRef, updateData);
    return updateData;
}

export async function getUserProfile(userId) {
    if (!userId) {
        return null;
    }

    const snapshot = await get(ref(db, 'users/' + userId));
    return snapshot.val();
}

export { 
    auth, 
    db, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    updateProfile, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged,
    onValue,
    push,
    remove,
    set,
    ref,
    update,
    get,
    getStorage,
    storageRef,
    uploadBytesResumable,
    getDownloadURL
};