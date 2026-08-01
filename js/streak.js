import { auth, onAuthStateChanged, updateUserStreak, getUserProfile } from '../assets/firebase/secured-firebase.js';

const streakBadge = document.getElementById('nav-streak');
const streakCount = streakBadge?.querySelector('.streak-count');
const verseModal = document.getElementById('verse-modal');
const verseIframe = document.getElementById('verse-iframe');
const verseTitle = document.getElementById('verse-modal-title');
const verseCloseBtn = document.getElementById('verse-close-btn');
const streakIcon = streakBadge?.querySelector('.streak-icon');
const STREAK_PRESS_KEY = 'children_ministry_streak_pressed_date';
let currentUser = null;

const getIframeUrl = () => {
    const search = 'x';
    const font = encodeURIComponent('14pt Garamond');
    const raw = encodeURIComponent('font-style:italic;text-align:center;color:#000;');
    return `https://www.topverses.com/widget2.php?find1=&fg=000000&bg=FFFFFF&font=${font}&raw=${raw}&search=${search}&rate=z&`;
};

const getLocalDayKey = () => {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
};

const getStreakPressedDate = () => {
    try {
        return window.localStorage.getItem(STREAK_PRESS_KEY);
    } catch (error) {
        return null;
    }
};

const setStreakPressedDate = (dateKey) => {
    try {
        window.localStorage.setItem(STREAK_PRESS_KEY, dateKey);
    } catch (error) {
        // ignore storage errors
    }
};

const isStreakPressedToday = () => {
    return getStreakPressedDate() === getLocalDayKey();
};

const isIndexPage = () => {
    const pageName = window.location.pathname.split('/').pop();
    return pageName === '' || pageName === 'index.html';
};

const updateStreakIcon = () => {
    if (!streakIcon) {
        return;
    }

    const shouldShowFire = isIndexPage() && isStreakPressedToday();
    if (shouldShowFire) {
        streakIcon.textContent = '🔥';
        streakBadge.classList.add('streak-pressed');
    } else {
        streakIcon.textContent = '🧊';
        streakBadge.classList.remove('streak-pressed');
    }
};

const openVerseModal = async () => {
    if (!verseModal || !verseIframe || !verseTitle) {
        return;
    }

    verseTitle.textContent = 'Streak Verse';
    verseIframe.src = getIframeUrl();
    verseModal.classList.remove('hidden');
    verseModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    if (currentUser) {
        try {
            const updated = await updateUserStreak(currentUser);
            if (streakCount) {
                streakCount.textContent = Number(updated.streak || 0);
            }
        } catch (error) {
            console.error('Unable to update streak on press:', error);
        }
    }

    setStreakPressedDate(getLocalDayKey());
    updateStreakIcon();
};

const closeVerseModal = () => {
    if (!verseModal) {
        return;
    }

    verseModal.classList.add('hidden');
    verseModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (verseIframe) {
        verseIframe.src = 'about:blank';
    }
};

const initVersePopup = () => {
    if (!streakBadge) {
        return;
    }

    streakBadge.addEventListener('click', openVerseModal);
    streakBadge.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openVerseModal();
        }
    });

    if (verseCloseBtn) {
        verseCloseBtn.addEventListener('click', closeVerseModal);
    }

    if (verseModal) {
        verseModal.addEventListener('click', (event) => {
            if (event.target === verseModal) {
                closeVerseModal();
            }
        });
    }
};

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
        const userData = await getUserProfile(user.uid);
        const currentStreak = Number(userData?.streak || 0);
        let displayStreak = currentStreak;

        if (userData?.lastVisitAt) {
            const today = new Date();
            const lastVisit = new Date(userData.lastVisitAt);
            const todayMidnight = new Date(today);
            const lastVisitMidnight = new Date(lastVisit);
            todayMidnight.setHours(0, 0, 0, 0);
            lastVisitMidnight.setHours(0, 0, 0, 0);
            const diffDays = Math.round((todayMidnight - lastVisitMidnight) / (1000 * 60 * 60 * 24));
            const streakExpired = diffDays > 1 || (diffDays === 1 && !isStreakPressedToday());

            if (streakExpired) {
                displayStreak = 0;
            }
        }

        streakCount.textContent = displayStreak;
        streakBadge.classList.remove('hidden');
        updateStreakIcon();
        if (isStreakPressedToday()) {
            animateStreak();
        }
    } catch (error) {
        console.error('Unable to load streak:', error);
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

    initVersePopup();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStreak);
} else {
    initStreak();
}
