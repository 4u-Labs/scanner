// ============================================
// DocScan Pro - Service Worker
// ============================================

const CACHE_NAME = 'docscan-pro-v10';
const OFFLINE_URL = 'index.php';

// Resources to cache for offline fallback
const STATIC_ASSETS = [
    './',
    'index.php',
    'style.css',
    'script.js',
    'shutter.mp3',
    'manifest.json',
    'icon-192x192.png',
    'icon-512x512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install v10 (Network-First)');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Pre-caching offline fallback assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[ServiceWorker] Skip waiting');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[ServiceWorker] Cache failed:', error);
            })
    );
});

// Activate event - clean ALL old caches immediately
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate v9');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => cacheName !== CACHE_NAME)
                        .map((cacheName) => {
                            console.log('[ServiceWorker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('[ServiceWorker] Claiming clients');
                return self.clients.claim();
            })
    );
});

// Fetch event - PURE NETWORK-FIRST: Always fetch live from server when online
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);
    const isAllowedOrigin =
        url.origin === self.location.origin ||
        url.origin === 'https://fonts.googleapis.com' ||
        url.origin === 'https://fonts.gstatic.com' ||
        url.origin === 'https://cdnjs.cloudflare.com';

    if (!isAllowedOrigin) {
        return;
    }

    // Always fetch directly from network first
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Only use cache when completely offline
                console.log('[ServiceWorker] Network offline, serving from cache:', event.request.url);
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    if (event.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    }
                });
            })
    );
});

// Background sync for pending uploads
self.addEventListener('sync', (event) => {
    console.log('[ServiceWorker] Sync event:', event.tag);

    if (event.tag === 'sync-uploads') {
        event.waitUntil(syncPendingUploads());
    }
});

async function syncPendingUploads() {
    try {
        // Open IndexedDB
        const db = await openDB();
        const pending = await getAllPending(db);

        for (const upload of pending) {
            try {
                // Attempt upload
                await uploadFile(upload);

                // Remove from pending
                await removePending(db, upload.id);

                // Notify client
                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SYNC_COMPLETE',
                        uploadId: upload.id
                    });
                });
            } catch (error) {
                console.error('[ServiceWorker] Upload failed:', error);
            }
        }
    } catch (error) {
        console.error('[ServiceWorker] Sync failed:', error);
    }
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('DocScanPro', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAllPending(db) {
    return new Promise((resolve) => {
        const transaction = db.transaction('pending', 'readonly');
        const store = transaction.objectStore('pending');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

function removePending(db, id) {
    return new Promise((resolve) => {
        const transaction = db.transaction('pending', 'readwrite');
        const store = transaction.objectStore('pending');
        store.delete(id);
        resolve();
    });
}

async function uploadFile(upload) {
    // This would be the actual upload logic
    // For demo purposes, we'll simulate success
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
}

// Push notifications (optional)
self.addEventListener('push', (event) => {
    console.log('[ServiceWorker] Push received');

    const options = {
        body: event.data?.text() || 'Nova atualização disponível',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100" rx="20"/><text y="65" x="50" text-anchor="middle" font-size="50">📄</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%236c5ce7" width="100" height="100" rx="50"/></svg>',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'open',
                title: 'Abrir App'
            },
            {
                action: 'close',
                title: 'Fechar'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('DocScan Pro', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[ServiceWorker] Notification click');

    event.notification.close();

    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handler
self.addEventListener('message', (event) => {
    console.log('[ServiceWorker] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'TRIGGER_SYNC') {
        self.registration.sync.register('sync-uploads');
    }
});

// Periodic background sync (for modern browsers)
self.addEventListener('periodicsync', (event) => {
    console.log('[ServiceWorker] Periodic sync:', event.tag);

    if (event.tag === 'sync-pending') {
        event.waitUntil(syncPendingUploads());
    }
});

console.log('[ServiceWorker] Loaded');
