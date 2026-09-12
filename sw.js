const CACHE_NAME = 'children-department-cache-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/events.html',
    '/divisions.html',
    '/login.html',
    '/grow.html',
    '/account.html',
    '/assets/secured/icons/logo.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName !== CACHE_NAME)
                    .map((cacheName) => caches.delete(cacheName))
            )
        ).then(() => self.clients.claim())
    );
});

const isSameOriginRequest = (request) => request.url.startsWith(self.location.origin);

const fetchAndCache = (request) => {
    return fetch(request).then((networkResponse) => {
        if (isSameOriginRequest(request) && networkResponse && networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse.clone());
            });
        }
        return networkResponse;
    });
};

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const networkFetch = fetchAndCache(event.request).catch(() => null);
            return cachedResponse || networkFetch;
        }).then((response) => {
            return response || caches.match('/download.html');
        })
    );
});
