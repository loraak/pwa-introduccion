// selección de los elementos del DOM. 
// shareImageButton -> botón flotante rosa con +. 
var shareImageButton = document.querySelector('#share-image-button');
// el <div> con el formulario (title, location, postear!
var createPostArea = document.querySelector('#create-post');
// botón para cerrar el formulario. 
var closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
// div vacío bajo el título "comparte tus momentos"
var sharedMomentsArea = document.querySelector('#shared-moments');

var form = document.querySelector('form');

var titleInput = document.querySelector('#title');

var locationInput = document.querySelector('#location');

// el formulario de nuevo post.
var createPostForm = document.querySelector('#create-post form');
// (deferredPrompt se declara y se llena en app.js)

function openCreatePostModal() {
    // muestra el modal de creación de posts. 
    createPostArea.style.transform = 'translateY(0)';

    // Si existe un evento de instalación guardado. 
    // Muestra el diálogo nativo de "agregar pantalla de inicio". 
    // userChoice detecta si el usuario aceptó o no. 
    // pone deferredPromt en null, porque el aviso puede usarse una vez. 
    // cuando el sitio cumple con los requisitos de una PWA, el navegador dice internamente "se puede instalar". Ahí se lanza el evento "beforeinstallprompt". 
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function(choiceResult) {
            console.log(choiceResult.outcome);
            if (choiceResult.outcome === 'dismissed') {
                console.log('User cancelled installation');
            } else {
                console.log('User added to home screen');
            }
        });
        deferredPrompt = null;
    }
}

function clearCards() {
    // elimina todos los elementos hijos de sharedMomentsArea.
    // Se llama antes de createCard() para no duplicar tarjetas. Si la caché dibuja una tarjeta y luego llega la respuesta de la red, clearCards() borra la primera y se dibuja la nueva, en vez de mostrar dos tarjetas. 
    while(sharedMomentsArea.hasChildNodes()) {
    sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
    }
}

// oculta el modal con display = "none". 
function closeCreatePostModal() {
    if (createPostArea) {
        createPostArea.style.display = 'none';
    }
}

if (shareImageButton) {
    shareImageButton.addEventListener('click', openCreatePostModal);
}

if (closeCreatePostModalButton) {
    closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);
}

// sin este preventDefault, al tocar "Postear!" el navegador envía el formulario y recarga la página.
// TODO: aquí falta el envío del post a Firebase.
if (createPostForm) {
    createPostForm.addEventListener('submit', function(event) {
        event.preventDefault();
    });
}

/* construye una tarjeta con estilo MDL (material desgin line).
function createCard() {
    if (!sharedMomentsArea) {
        return;
    }

    // contenedor principal con clases mdd-lard y sombra. 
    var cardWrapper = document.createElement('div');
    cardWrapper.className = 'shared-moment-card mdl-card mdl-shadow--2dp';

    // cabecera con imagen de fondo. 
    var cardTitle = document.createElement('div');
    cardTitle.className = 'mdl-card__title';
    cardTitle.style.backgroundImage = 'url("/src/images/sf-boat.jpg")';
    cardTitle.style.backgroundSize = 'cover';
    cardTitle.style.height = '180px';
    cardWrapper.appendChild(cardTitle);

    // titulo en color. 
    var cardTitleTextElement = document.createElement('h2');
    cardTitleTextElement.className = 'mdl-card__title-text';
    cardTitleTextElement.textContent = 'San Francisco Prueba 3';
    cardTitleTextElement.style.color = "cyan";
    cardTitle.appendChild(cardTitleTextElement);

    // texto centrado. 
    var cardSupportingText = document.createElement('div');
    cardSupportingText.className = 'mdl-card__supporting-text';
    cardSupportingText.textContent = 'In San Francisco';
    cardSupportingText.style.textAlign = 'center';
    cardWrapper.appendChild(cardSupportingText);
    
    // componentHandler es un elemento de MDL. Cuando se crean elementos (createElement) y pones la clase MDL, el navegador solo ve un <div> con la clase. MDL necesita activar ese elemento para aplicarle su comportamiento y estilos dinámicos. 
    // MDL hace esa activación automáticamente al cargar la página, pero solo para los elementos ya existentes en el HTML. 
    // como cardwrapper se crea después, hay qu eavisarle manualmente a MDl con este método. 
    componentHandler.upgradeElement(cardWrapper);

    // acá se inserta la tarjeta ya construida dentro del <div id="shared-moments">. Hasta este punto la tarjeta ya es visible en la página. 
    sharedMomentsArea.appendChild(cardWrapper);
}
*/

function createCard(data) {
    if (!sharedMomentsArea) {
        return;
    }

    var cardWrapper = document.createElement("div");
    cardWrapper.className = "shared-moment-card mdl-card mdl-shadow--2dp";

    var cardTitle = document.createElement("div");
    cardTitle.className = "mdl-card__title";
    cardTitle.style.backgroundImage = 'url("' + data.image + '")';
    cardTitle.style.backgroundSize = "cover";
    cardTitle.style.height = "180px";
    cardWrapper.appendChild(cardTitle);

    var cardTitleTextElement = document.createElement("h2");
    cardTitleTextElement.style.color = "cyan";
    cardTitleTextElement.className = "mdl-card__title-text";
    cardTitleTextElement.textContent = data.title;
    cardTitle.appendChild(cardTitleTextElement);

    var cardSupportingText = document.createElement("div");
    cardSupportingText.className = "mdl-card__supporting-text";
    cardSupportingText.textContent = data.location;
    cardSupportingText.style.textAlign = "center";
    cardWrapper.appendChild(cardSupportingText);

    if (window.componentHandler) {
        componentHandler.upgradeElement(cardWrapper);
    }

    sharedMomentsArea.appendChild(cardWrapper);
}

// anterior -> en resumen construye esta estructura: 
// div.mdl-card
// ├── div.mdl-card__title (imagen de fondo)
// │    └── h2 (título en cyan)
// └── div.mdl-card__supporting-text (texto centrado)


// fetch hace la petición. 
// el primer .then convierte la respuesta a objeto JS con res.json (devuelve otra promesa). 
// el segundo .then recibe los datos convertidos y: 
// pone networkDataReceived=true, para avisar que la red respondió. 
// muestra los datos en consola con la etiqueta from web. 
// llama a clearcards() para borrar tarjetas previas. 
// llama a createcard() para dibujar la tarjeta nueva. 
/*
fetch(url)
.then(function(res) {
    return res.json();
    })
.then(function(data) {
    networkDataReceived = true;
    console.log('From web', data);
    clearCards();
    createCard();
});
*/

function updateUI(dataArray) {
    clearCards();
    for (var i = 0; i < dataArray.length; i++) {
        createCard(dataArray[i]);
    }
}

var url = "https://uteq-gram-758a9-default-rtdb.firebaseio.com/post.json";
var networkDataReceived = false;

// petición get a la base de datos. 
fetch(url)
    .then(function (res) {
        return res.json();
    })
    .then(function (data) {
        networkDataReceived = true;
        console.log("From web", data);
        updateUI(objectToArray(data));
    })
    .catch(function (err) {
        console.log("Network fetch failed, using cache if available", err);
});

// acá se leen todos los datos. 
if('indexedDB' in window) { 
    readAllData('posts') 
    .then(function(data) { 
        if (!networkDataReceived) { 
            console.log('DESDE CACHE', data); 
            updateUI(data); 
        }
    }); 
}

// caches in window verifica que el navegador soporta la cache api (necesaria para apis pwas y service workers). 
// caches.match(url) busca si hay una respuesta guardada para esa URL. 
// si existe, la convierte a JSON. 
// en el segundo .then, si la red todavía no responde, dibuja la tarjeta con los datos de la caché. 

// la idea de fondo acá es que ambas peticiones (red y caché) se lanzan casi al mismo tiempo, y compiten: 
// caché responde primero -> se muestra la tarjeta rápido con datos guardados; luego llega la red, clearCards() borra esa tarjeta y se dibuja la actualizada. 
// red responde primero -> se dibuja la tarjeta con datos frescos y networkDataReceived = true; cuando la caché responde, el if impide que sobrescriba datos más nuevos con datos viejos. 
// sin conexión -> la red falla, pero la caché sigue mostrando contenido. 
if ("caches" in window) {
    caches
        .match(url)
        .then(function (response) {
        if (response) {
            return response.json();
        }
        })
        .then(function (data) {
        console.log("From cache", data);
        if (data && !networkDataReceived) {
            updateUI(objectToArray(data));
        }
        })
        .catch(function (err) {
        console.log("Cache read failed", err);
        });
}

function objectToArray(data) {
    var dataArray = [];
    for (var key in data) {
        dataArray.push(data[key]);
    }
    return dataArray;
}

function sendData() { 
    fetch(url, { 
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }, 
        body: JSON.stringify({
            id: new Date().toISOString(),
            title: titleInput.value,
            location: locationInput.value,
            image: ''
        })
    })
    .then (function(res) { 
        console.log('Sent data', res);
        updateUI(); 
    })
}

form.addEventListener('submit', function(event) { 
    event.preventDefault(); 

    if (titleInput.value.trim() === '' || locationInput.value.trim() === '') {
        alert('Please enter valid data!'); 
        return; 
    }

    closeCreatePostModal();

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready 
        .then(function(sw) { 
            var post = { 
                id: new Date().toISOString(),
                title: titleInput.value,
                location: locationInput.value,
            }; 
            writeData('sync-posts', post) 
                .then(function() { 
                    return sw.sync.register('sync-new-posts'); 
                })
                .then(function() { 
                    var snackbarContainer = document.querySelector('#confirmation-toast');
                    var data = { message: 'Your Post was saved for syncing!' };
                    snackbarContainer.MaterialSnackbar.showSnackbar(data);
                })
                .catch(function(err) { 
                    console.log(err);
                }); 
            }); 
        } else { 
            sendData();
        }
}); 