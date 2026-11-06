// service worker que complementa el feed.js. Intercepta las peticiones y decide de dónde salen las respuestas: caché o red.

importScripts('/src/js/idb.js');
importScripts('/src/js/utility.js');

// static -> archivos del "app shell" (HTML, CSS, JS, imágenes base) que se guardan desde el inicio.
// dynamic -> todo lo que se va descargando mientras el usuario navega.
// IMPORTANTE: sube la versión cada vez que cambies feed.js, css, etc., porque el app shell es cache-first.
var CACHE_STATIC_NAME = 'static-v10';
var CACHE_DYNAMIC_NAME = 'dynamic-v10';

var STATIC_FILES = [
    '/',
    '/index.html',
    '/offline.html',
    //'/manifest.json',
    '/src/js/app.js',
    '/src/js/feed.js',
    '/src/js/idb.js',
    '/src/js/utility.js',
    '/src/js/material.min.js',
    '/src/css/app.css',
    '/src/css/feed.css',
    '/src/images/main-image.jpg',
    '/src/images/icons/icon-192.png',
    '/src/images/icons/apple-touch-icon-180.png',
    '/src/images/icons/favicon-32.png',
    'https://fonts.googleapis.com/css?family=Roboto:400,700',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
    'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'
];

var FIREBASE_URL = 'https://uteq-gram-758a9-default-rtdb.firebaseio.com/post.json';

// install: precaching del app shell.
// Se agrega archivo por archivo: si uno falla (404, sin red), solo se avisa en consola
// y el resto sí se guarda. Con cache.addAll() un solo 404 tumba todo el precaché.
// waitUntil espera a que todo termine gracias al return.
self.addEventListener('install', function (event) {
    console.log('[Service Worker] Installing Service Worker ...', event);
    event.waitUntil(
        caches.open(CACHE_STATIC_NAME)
        .then(function (cache) {
            console.log('[Service Worker] Precaching App Shell');
            return Promise.all(STATIC_FILES.map(function (file) {
                return cache.add(file).catch(function (err) {
                    console.warn('[Service Worker] No se pudo cachear:', file, err);
                });
            }));
        })
        .then(function () {
            // activa la nueva versión sin esperar a que se cierren las pestañas
            return self.skipWaiting();
        })
    );
});

// activate: borra cachés de versiones anteriores y toma control de las páginas abiertas.
self.addEventListener('activate', function (event) {
    console.log('[Service Worker] Activating Service Worker ....', event);
    event.waitUntil(
        caches.keys()
        .then(function (keyList) {
            return Promise.all(keyList.map(function (key) {
                if (key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME) {
                    console.log('[Service Worker] Removing old cache.', key);
                    return caches.delete(key);
                }
            }));
        })
        .then(function () {
            return self.clients.claim();
        })
    );
});

function isInArray(string, array) {
    var cachePath;
    if (string.indexOf(self.origin) === 0) {
        cachePath = string.substring(self.origin.length);
    } else {
        cachePath = string;
    }
    return array.indexOf(cachePath) > -1;
}

self.addEventListener('fetch', function (event) {
    var request = event.request;

    // Solo las peticiones GET se pueden cachear. POST, PUT, etc. pasan directo a la red.
    if (request.method !== 'GET') {
        return;
    }

    // A) Datos de Firebase: network first y se refresca IndexedDB.
    if (request.url.indexOf(FIREBASE_URL) > -1) {
        event.respondWith(
            fetch(request)
            .then(function (res) {
                // solo se actualiza IndexedDB si la respuesta fue buena; si no, se conservan los datos viejos.
                if (res.ok) {
                    var clonedRes = res.clone();
                    event.waitUntil(
                        clonedRes.json()
                        .then(function (data) {
                            // data puede ser null si la base está vacía
                            if (!data || typeof data !== 'object') {
                                return clearAllData('posts');
                            }
                            return clearAllData('posts')
                            .then(function () {
                                var writes = [];
                                for (var key in data) {
                                    var post = data[key];
                                    // el almacén 'posts' usa 'id' como keyPath; si el post no trae uno, se usa la llave de Firebase.
                                    if (post && typeof post === 'object') {
                                        if (post.id === undefined) {
                                            post.id = key;
                                        }
                                        writes.push(writeData('posts', post));
                                    }
                                }
                                return Promise.all(writes);
                            });
                        })
                        .catch(function (err) {
                            console.log('[SW] No se pudo guardar en IndexedDB', err);
                        })
                    );
                }
                return res;
            })
            .catch(function (err) {
                // sin red: feed.js lo detecta en su catch y usa IndexedDB
                console.log('[SW] Firebase no disponible', err);
                return Response.error();
            })
        );
        return;
    }

    // B) App shell: cache first.
    if (isInArray(request.url, STATIC_FILES)) {
        event.respondWith(
            caches.match(request)
            .then(function (response) {
                return response || fetch(request);
            })
        );
        return;
    }

    // C) Todo lo demás: cache, luego red (y se guarda en la caché dinámica).
    event.respondWith(
        caches.match(request)
        .then(function (response) {
            if (response) {
                return response;
            }
            return fetch(request)
            .then(function (res) {
                // solo se guardan respuestas buenas (200) o de otros orígenes sin CORS (opaque), y solo http/https.
                if (request.url.indexOf('http') !== 0 || !(res.status === 200 || res.type === 'opaque')) {
                    return res;
                }
                var copy = res.clone();
                return caches.open(CACHE_DYNAMIC_NAME)
                .then(function (cache) {
                    cache.put(request.url, copy);
                    return res;
                });
            })
            .catch(function () {
                // sin red: si era una página HTML, se muestra offline.html.
                var accept = request.headers.get('accept') || '';
                if (accept.indexOf('text/html') > -1) {
                    return caches.open(CACHE_STATIC_NAME)
                    .then(function (cache) {
                        return cache.match('/offline.html');
                    });
                }
                return Response.error();
            });
        })
    );
});

// Background Sync: envía a Firebase los posts guardados offline.
// Se devuelve Promise.all para que waitUntil espere todos los fetch,
// y se lanza error si Firebase rechaza, para que el navegador reintente el sync.
self.addEventListener('sync', function (event) {
    console.log('[Service Worker] Background syncing', event);
    if (event.tag === 'sync-new-posts') {
        console.log('[Service Worker] Syncing new Posts');
        event.waitUntil(
            readAllData('sync-posts')
            .then(function (data) {
                return Promise.all(data.map(function (dt) {
                    return fetch(FIREBASE_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json'
                        },
                        body: JSON.stringify({
                            id: dt.id,
                            title: dt.title,
                            location: dt.location
                            //image: '...'
                        })
                    })
                    .then(function (res) {
                        console.log('Sent data', res);
                        if (!res.ok) {
                            throw new Error('Firebase respondió ' + res.status);
                        }
                        return deleteItemFromData('sync-posts', dt.id);
                    });
                }));
            })
        );
    }
});