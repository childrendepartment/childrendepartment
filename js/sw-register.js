const installButton = document.getElementById('install-app-btn');
let deferredPrompt = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((error) => {
            console.warn('Service worker registration failed:', error);
        });
    });
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;

    if (installButton) {
        installButton.style.display = 'inline-flex';
        installButton.addEventListener('click', async () => {
            if (!deferredPrompt) {
                return;
            }

            installButton.disabled = true;
            deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;
            deferredPrompt = null;
            installButton.style.display = 'none';
            installButton.disabled = false;

            if (choiceResult.outcome === 'accepted') {
                console.log('App installation accepted');
            }
        });
    }
});

window.addEventListener('appinstalled', () => {
    if (installButton) {
        installButton.style.display = 'none';
    }
});
