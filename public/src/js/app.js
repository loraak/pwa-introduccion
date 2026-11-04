// comprueba si el navegador soporta Service Workers. 
if ('serviceWorker' in navigator) { 
    // Registra el archivo /sw.js. 
    navigator.serviceWorker.register('/sw.js')
        // funciona el registro e imprime esto. 
        .then(function() {
            console.log('Service Worker Registered!');
        }
    )
}