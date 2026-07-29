import { auth, onAuthStateChanged, updateUserStreak } from '../assets/firebase/secured-firebase.js';

const streakBadge = document.getElementById('nav-streak');
const streakCount = streakBadge?.querySelector('.streak-count');

const hideStreak = () => {
    if (!streakBadge) return;
    streakBadge.classList.add('hidden');
};

const animateStreak = () => {
    if (!streakBadge) return;
    streakBadge.classList.add('streak-animate');
    window.setTimeout(() => streakBadge.classList.remove('streak-animate'), 900);
};

const renderStreak = async (user) => {
    if (!streakBadge || !streakCount || !user) {
        hideStreak();
        return;
    }

    try {
        const streakData = await updateUserStreak(user);
        streakCount.textContent = Number(streakData.streak || 0);
        streakBadge.classList.remove('hidden');
        animateStreak();
    } catch (error) {
        console.error('Unable to update streak:', error);
        hideStreak();
    }
};

const initStreak = () => {
    if (!streakBadge) {
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await renderStreak(user);
        } else {
            hideStreak();
        }
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStreak);
} else {
    initStreak();
}
