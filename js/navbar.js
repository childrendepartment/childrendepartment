document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.navbar').forEach((navbar) => {
        const toggleButton = navbar.querySelector('.nav-toggle');
        const navMenu = navbar.querySelector('.navigation-redirect');
        const accountChip = navbar.querySelector('#nav-account-chip');
        const accountItem = navbar.querySelector('#account-nav-item');
        const loginItem = navbar.querySelector('#login-nav-item');

        if (!toggleButton || !navMenu) {
            return;
        }

        const ACCOUNT_COOKIE_NAME = 'children_ministry_account';

        const getStoredAccount = () => {
            const cookieValue = document.cookie
                .split('; ')
                .find((row) => row.startsWith(`${ACCOUNT_COOKIE_NAME}=`));

            if (cookieValue) {
                try {
                    return JSON.parse(decodeURIComponent(cookieValue.split('=').slice(1).join('=')));
                } catch (error) {
                    return null;
                }
            }

            if (window.localStorage) {
                const storedValue = window.localStorage.getItem(ACCOUNT_COOKIE_NAME);
                if (storedValue) {
                    try {
                        return JSON.parse(storedValue);
                    } catch (error) {
                        return null;
                    }
                }
            }

            return null;
        };

        const setStoredAccount = (account) => {
            const payload = JSON.stringify(account);
            const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
            document.cookie = `${ACCOUNT_COOKIE_NAME}=${encodeURIComponent(payload)}; expires=${expires}; path=/; SameSite=Lax`;
            if (window.localStorage) {
                window.localStorage.setItem(ACCOUNT_COOKIE_NAME, payload);
            }
        };

        const clearStoredAccount = () => {
            document.cookie = `${ACCOUNT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            if (window.localStorage) {
                window.localStorage.removeItem(ACCOUNT_COOKIE_NAME);
            }
        };

        const NOTIFICATION_STORAGE_KEY = 'children_ministry_notifications_enabled';
        const NOTIFICATION_MENU_ID = 'notification-nav-item';
        const NOTIFICATION_BUTTON_ID = 'notification-toggle-btn';
        let notificationMenuItem = null;
        let notificationToggleButton = null;

        const isAppInstalled = () => {
            const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
            const displayModeFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
            const displayModeMinimal = window.matchMedia('(display-mode: minimal-ui)').matches;
            return displayModeStandalone || displayModeFullscreen || displayModeMinimal || window.navigator.standalone === true;
        };

        const getNotificationEnabled = () => {
            try {
                const storedValue = window.localStorage?.getItem(NOTIFICATION_STORAGE_KEY);
                if (storedValue === 'false') {
                    return false;
                }
                return true;
            } catch (error) {
                return true;
            }
        };

        const hasStoredNotificationPreference = () => {
            try {
                return window.localStorage?.getItem(NOTIFICATION_STORAGE_KEY) !== null;
            } catch (error) {
                return false;
            }
        };

        const setNotificationEnabled = (enabled) => {
            try {
                window.localStorage?.setItem(NOTIFICATION_STORAGE_KEY, enabled ? 'true' : 'false');
            } catch (error) {
                // ignore storage failure
            }
            updateNotificationMenu();
        };

        const requestNotificationPermission = async () => {
            if (!('Notification' in window)) {
                alert('This browser does not support notifications.');
                return false;
            }

            if (Notification.permission === 'granted') {
                return true;
            }

            if (Notification.permission === 'denied') {
                alert('Notifications are blocked in your browser. Allow them from browser settings.');
                return false;
            }

            const permission = await Notification.requestPermission();
            return permission === 'granted';
        };

        const showAppNotification = async (title, options = {}) => {
            if (!isAppInstalled() || !getNotificationEnabled()) {
                return;
            }

            if (!('Notification' in window) || Notification.permission !== 'granted') {
                return;
            }

            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready.catch(() => null);
                if (registration && registration.showNotification) {
                    return registration.showNotification(title, options);
                }
            }

            try {
                new Notification(title, options);
            } catch (error) {
                console.warn('Unable to show notification:', error);
            }
        };

        window.showAppNotification = showAppNotification;

        const createNotificationMenuItem = () => {
            if (!navMenu || notificationMenuItem) {
                return;
            }

            const existingItem = navMenu.querySelector(`#${NOTIFICATION_MENU_ID}`);
            if (existingItem) {
                notificationMenuItem = existingItem;
                notificationToggleButton = existingItem.querySelector(`#${NOTIFICATION_BUTTON_ID}`);
                return;
            }

            const listItem = document.createElement('li');
            listItem.id = NOTIFICATION_MENU_ID;
            listItem.className = 'nav-account-item hidden';
            listItem.innerHTML = `
                <button type="button" class="nav-account-chip" id="${NOTIFICATION_BUTTON_ID}" aria-haspopup="dialog">
                    <span class="chip-label">Notifications</span>
                    <span class="chip-meta"></span>
                </button>
            `;

            navMenu.insertBefore(listItem, accountItem || null);
            notificationMenuItem = listItem;
            notificationToggleButton = listItem.querySelector(`#${NOTIFICATION_BUTTON_ID}`);

            if (notificationToggleButton) {
                notificationToggleButton.addEventListener('click', async () => {
                    if (getNotificationEnabled()) {
                        setNotificationEnabled(false);
                    } else {
                        const granted = await requestNotificationPermission();
                        if (granted) {
                            setNotificationEnabled(true);
                            await showAppNotification('Notifications enabled', {
                                body: 'You will receive updates for new lessons and events.',
                                icon: '/assets/secured/icons/logo.png',
                                badge: '/assets/secured/icons/logo.png',
                            });
                        }
                    }

                    if (window.innerWidth <= 768) {
                        closeMenu();
                    }
                });
            }
        };

        const updateNotificationMenu = () => {
            createNotificationMenuItem();

            if (!notificationMenuItem || !notificationToggleButton) {
                return;
            }

            const visible = isAppInstalled() && 'Notification' in window;
            notificationMenuItem.classList.toggle('hidden', !visible);

            const enabled = getNotificationEnabled();
            notificationToggleButton.querySelector('.chip-meta').textContent = enabled ? 'On' : 'Off';
            notificationToggleButton.setAttribute('aria-pressed', String(enabled));

            if (!hasStoredNotificationPreference() && visible) {
                if (Notification.permission === 'granted') {
                    setNotificationEnabled(true);
                }
            }
        };

        const getStoredNotificationDate = () => {
            try {
                return window.localStorage?.getItem('children_ministry_last_saturday_notification');
            } catch (error) {
                return null;
            }
        };

        const setStoredNotificationDate = (value) => {
            try {
                window.localStorage?.setItem('children_ministry_last_saturday_notification', value);
            } catch (error) {
                // ignore storage failure
            }
        };

        const notifySaturdayReminderIfNeeded = async () => {
            if (!isAppInstalled() || !getNotificationEnabled() || !('Notification' in window) || Notification.permission !== 'granted') {
                return;
            }

            const today = new Date();
            const isSaturday = today.getDay() === 6;
            if (!isSaturday) {
                return;
            }

            const currentDateKey = today.toISOString().slice(0, 10);
            if (getStoredNotificationDate() === currentDateKey) {
                return;
            }

            await showAppNotification('See you tomorrow in Church!', {
                body: 'Enjoy your Saturday and get ready for Sunday service.',
                icon: '/assets/secured/icons/logo.png',
                badge: '/assets/secured/icons/logo.png',
            });

            setStoredNotificationDate(currentDateKey);
        };

        const initAppNotificationSupport = () => {
            if (!('serviceWorker' in navigator) || !('Notification' in window)) {
                return;
            }

            if (window.location.protocol.startsWith('http') || window.location.hostname === 'localhost') {
                navigator.serviceWorker.register('/sw.js').catch((error) => {
                    console.warn('Service worker registration failed:', error);
                });
            }

            updateNotificationMenu();
            notifySaturdayReminderIfNeeded();

            window.addEventListener('appinstalled', () => {
                updateNotificationMenu();
                notifySaturdayReminderIfNeeded();
            });
            const standaloneQuery = window.matchMedia('(display-mode: standalone)');
            standaloneQuery.addEventListener?.('change', () => {
                updateNotificationMenu();
                notifySaturdayReminderIfNeeded();
            });
        };

        const renderAccountChip = () => {
            if (!accountItem || !accountChip) {
                return;
            }

            const account = getStoredAccount();

            if (!account?.name && !account?.email) {
                accountItem.classList.add('hidden');
                if (loginItem) {
                    loginItem.classList.remove('hidden');
                }
                return;
            }

            accountItem.classList.remove('hidden');
            if (loginItem) {
                loginItem.classList.add('hidden');
            }
            const displayName = account.name || account.email?.split('@')[0] || 'Account';
            accountChip.innerHTML = `<span class="chip-label">${displayName}</span><span class="chip-meta">Signed in</span>`;
        };

        const openLogoutModal = () => {
            if (document.getElementById('logout-modal')) {
                document.getElementById('logout-modal').classList.remove('hidden');
                return;
            }

            const account = getStoredAccount();
            const displayName = account?.name || account?.email?.split('@')[0] || 'there';
            const overlay = document.createElement('div');
            overlay.id = 'logout-modal';
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="logout-modal-title">
                    <h3 id="logout-modal-title">Log out?</h3>
                    <p>Do you wish to log out, <strong>${displayName}</strong>?</p>
                    <div class="modal-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="button" class="confirm-btn">Confirm</button>
                    </div>
                </div>
            `;

            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    overlay.remove();
                }
            });

            overlay.querySelector('.cancel-btn').addEventListener('click', () => overlay.remove());
            overlay.querySelector('.confirm-btn').addEventListener('click', () => {
                clearStoredAccount();
                renderAccountChip();
                overlay.remove();
                window.location.href = 'login.html';
            });

            document.body.appendChild(overlay);
        };

        window.setAccountCookie = setStoredAccount;
        window.clearAccountCookie = clearStoredAccount;
        window.updateNavbarAuthState = renderAccountChip;
        renderAccountChip();

        if (accountChip) {
            accountChip.addEventListener('click', () => {
                const account = getStoredAccount();
                if (account?.name || account?.email) {
                    openLogoutModal();
                }
            });
        }

        const closeMenu = () => {
            navMenu.classList.remove('open');
            toggleButton.classList.remove('active');
            toggleButton.setAttribute('aria-expanded', 'false');
        };

        const openMenu = () => {
            navMenu.classList.add('open');
            toggleButton.classList.add('active');
            toggleButton.setAttribute('aria-expanded', 'true');
        };

        toggleButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = navMenu.classList.contains('open');

            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        navMenu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    closeMenu();
                }
            });
        });

        document.addEventListener('click', (event) => {
            if (window.innerWidth <= 768 && !navbar.contains(event.target)) {
                closeMenu();
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                closeMenu();
            }
        });

        initAppNotificationSupport();
    });
});
