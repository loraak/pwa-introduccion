// service worker que complementa el feed.js. Intercepta las peticiones y decide de dónde salen las respuestas: caché o red. 

importScripts('/src/js/idb.js')
importScripts('/src/js/utility.js')

// static -> archivos del "app shell" (HTML, CSS, JS, imágenes base) que se guardan desde el inicio. 
// dyanmic -> todo lo que se va descargando mientras el usuario navega. 
var CACHE_STATIC_NAME = 'static-v6';
var CACHE_DYNAMIC_NAME = 'dynamic-v6';

var STATIC_FILES = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
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

// evento install: precaching del app shell. 
// se dispara una vez, cuando el navegador instala una nueva versión del service worker. 
// event.wailUntil() indica al navegador "no termines la instalación hasta que esta promesa se resuelva". 
// caches.open() abre la caché estática. 
// caché.addAll() descarga cada URL de la lista y la guarda. Incluye archivos locales y recursos externos. 
// si una sola de esas URLs falla, addAll falla completo y el service worker no se instala. 
self.addEventListener('install', function(event) {
    console.log('[Service Worker] Installing Service Worker ...', event);
    event.waitUntil(
        caches.open(CACHE_STATIC_NAME)
        .then(function(cache) {
            console.log('[Service Worker] Precaching App Shell');
            cache.addAll(STATIC_FILES);
        })
    )
});

// se dispara cuando el nuevo service worker toma el control. 
// caches.keys() devuelve los nombres de todas las cachés existentes. 
// con map se recorre cada nombre. Si no coincide con el nombre puesto de caché, es de una versión anterior y se elimina. 
// promise.all espera a que todas las eliminaciones terminen. 
// self.clients.claim() hace que el service worker controle de inmediato las páginas abiertas, sin esperar a que se recarguen.
self.addEventListener('activate', function(event) {
    console.log('[Service Worker] Activating Service Worker ....', event);
    event.waitUntil(
        caches.keys()
        .then(function(keyList) {
            return Promise.all(keyList.map(function(key) {
                if (key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME) {
                    console.log('[Service Worker] Removing old cache.', key);
                    return caches.delete(key);
                }
            }));
        })
        .then(function() {
            return self.clients.claim();
        })
    );
});

// se ejecuta cada vez que la página pide algo (html, css, imágenes, fetch(), etc) Aquí hay dos estrategias. 
// caso A -> "network then caché" -> se abre la caché dinámica y se va siempre a la red, cuando llega la respuesta, se guarda una copia con cache.put... res.clone() es necesario porque el cuerpo de una respuesta solo se puede leer una vez. Una copia va a la caché y la original vuelve a la página. Se devuelve res a la página. 
//cache-then-network-offline
/*
self.addEventListener('fetch', function (event) {
    var url = 'https://httpbin.org/get';

    if (event.request.url.indexOf(url) > -1) {
        event.respondWith(
        caches.open(CACHE_DYNAMIC_NAME)
        .then(function (cache) {
            return fetch(event.request)
            .then(function (res) {
                cache.put(event.request, res.clone());
                return res;
            });
        })
        );
    } else {
    event.respondWith(
    caches.match(event.request)
    .then(function (response) {
    if (response) {
    return response;
    } else {
    return fetch(event.request)
    .then(function (res) {
    return caches.open(CACHE_DYNAMIC_NAME)
    .then(function (cache) {
    cache.put(event.request.url, res.clone());
    return res;
    })
    })
    .catch(function (err) {
    return caches.open(CACHE_STATIC_NAME)
    .then(function (cache) {
    return cache.match('/offline.html');
    });
    });
    }
    })
    );
    }
});
*/

function isInArray(string, array) { 
    var cachePath; 
    if (string.indexOf(self.origin) === 0) { 
        console.log('matched', string); 
        cachePath = string.substring(self.origin.length); 
    } else { 
        cachePath = string; 
    }
    return array.indexOf(cachePath) > -1; 
}

self.addEventListener('fetch', function(event) {
    var request = event.request;

    // Solo las peticiones GET se pueden cachear. POST, PUT, etc. (por ejemplo, enviar un post nuevo) pasan directo a la red.
    if (request.method !== 'GET') {
        return;
    }

    // A) Datos de Firebase.
    if (request.url.indexOf(FIREBASE_URL) > -1) {
        console.log('[SW] Petición a Firebase detectada', request.url);
        event.respondWith(
            fetch(request)
            .then(function(res) {
                // solo se actualiza IndexedDB si la respuesta fue buena; si no, se conservan los datos viejos.
                if (res.ok) {
                    var clonedRes = res.clone();
                    // waitUntil mantiene vivo el service worker hasta que termine de escribir en IndexedDB.
                    event.waitUntil(
                        clonedRes.json()
                        .then(function(data) {
                            // primero se lee el JSON y solo después se borra, así nunca se pierde lo guardado si algo falla.
                            return clearAllData('posts')
                            .then(function() {
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
                        .catch(function(err) {
                            console.log('[SW] No se pudo guardar en IndexedDB', err);
                        })
                    );
                }
                return res;
            })
        );
        return;
    }

    // B) App shell.
    if (isInArray(request.url, STATIC_FILES)) {
        event.respondWith(
            caches.match(request)
            .then(function(response) {
                return response || fetch(request);
            })
        );
        return;
    }

    // C) Todo lo demás.
    event.respondWith(
        caches.match(request)
        .then(function(response) {
            if (response) {
                return response;
            }
            return fetch(request)
            .then(function(res) {
                // solo se guardan respuestas buenas (200) o de otros orígenes sin CORS (opaque), y solo http/https.
                // (esquemas como chrome-extension:// o respuestas parciales 206 hacen que cache.put lance error).
                if (request.url.indexOf('http') !== 0 || !(res.status === 200 || res.type === 'opaque')) {
                    return res;
                }
                return caches.open(CACHE_DYNAMIC_NAME)
                .then(function(cache) {
                    cache.put(request.url, res.clone());
                    return res;
                });
            })
            .catch(function(err) {
                // sin red: si era una página HTML, se muestra offline.html.
                // (accept puede venir vacío, por eso el "|| ''").
                var accept = request.headers.get('accept') || '';
                if (accept.indexOf('text/html') > -1) {
                    return caches.open(CACHE_STATIC_NAME)
                    .then(function(cache) {
                        return cache.match('/offline.html');
                    });
                }
                return Response.error();
            });
        })
    );
});
