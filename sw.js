const CACHE = 'tripsplit-v3';
const FILES = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(FILES))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(
                keys.filter(key => key !== CACHE).map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});