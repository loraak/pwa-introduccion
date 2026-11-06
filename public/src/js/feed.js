var shareImageButton = document.querySelector("#share-image-button");
var createPostArea = document.querySelector("#create-post");
var closeCreatePostModalButton = document.querySelector(
  "#close-create-post-modal-btn",
);
var form = document.querySelector("form");
var titleInput = document.querySelector("#title");
var locationInput = document.querySelector("#location");
var sharedMomentsArea = document.querySelector("#shared-moments");

var DEFAULT_IMAGE = "https://media.tenor.com/2nCqe89AsMsAAAAe/peso-pluma-gato.png";;
var url = "https://uteq-gram-758a9-default-rtdb.firebaseio.com/post.json";
var networkDataReceived = false;

function openCreatePostModal() {
  if (!createPostArea) return;

  createPostArea.style.display = "block";
  // forzamos un reflow para que la transición de entrada sí se vea
  void createPostArea.offsetHeight;
  createPostArea.style.transform = "translateY(0)";

  // deferredPrompt debe guardarlo app.js (evento beforeinstallprompt) en window
  if (window.deferredPrompt) {
    window.deferredPrompt.prompt();

    window.deferredPrompt.userChoice.then(function (choiceResult) {
      console.log(choiceResult.outcome);
      if (choiceResult.outcome === "dismissed") {
        console.log("User cancelled installation");
      } else {
        console.log("User added to home screen");
      }
    });

    window.deferredPrompt = null;
  }
}

function closeCreatePostModal() {
  if (createPostArea) {
    createPostArea.style.transform = "translateY(100vh)";
  }
}

if (shareImageButton) {
  shareImageButton.addEventListener("click", openCreatePostModal);
}

if (closeCreatePostModalButton) {
  closeCreatePostModalButton.addEventListener("click", closeCreatePostModal);
}

function clearCards() {
  if (sharedMomentsArea) {
    while (sharedMomentsArea.hasChildNodes()) {
      sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
    }
  }
}

function createCard(data) {
  if (!sharedMomentsArea || !data || typeof data !== "object") {
    return;
  }

  // acepta "image" o "imagen" (tu primer post en Firebase usa "imagen")
  var imgUrl = data.image || data.imagen || DEFAULT_IMAGE;

  var cardWrapper = document.createElement("div");
  cardWrapper.className = "shared-moment-card mdl-card mdl-shadow--2dp";

  var cardTitle = document.createElement("div");
  cardTitle.className = "mdl-card__title";
  cardTitle.style.backgroundImage = 'url("' + imgUrl + '")';
  cardTitle.style.backgroundSize = "cover";
  cardTitle.style.backgroundPosition = "center";
  cardTitle.style.height = "180px";
  cardWrapper.appendChild(cardTitle);

  var cardTitleTextElement = document.createElement("h2");
  cardTitleTextElement.style.color = "cyan";
  cardTitleTextElement.className = "mdl-card__title-text";
  cardTitleTextElement.textContent = data.title || "";
  cardTitle.appendChild(cardTitleTextElement);

  var cardSupportingText = document.createElement("div");
  cardSupportingText.className = "mdl-card__supporting-text";
  cardSupportingText.textContent = data.location || "";
  cardSupportingText.style.textAlign = "center";
  cardWrapper.appendChild(cardSupportingText);

  if (window.componentHandler) {
    componentHandler.upgradeElement(cardWrapper);
  }

  sharedMomentsArea.appendChild(cardWrapper);
}

function updateUI(dataArray) {
  clearCards();
  if (!Array.isArray(dataArray)) return;
  for (var i = 0; i < dataArray.length; i++) {
    createCard(dataArray[i]);
  }
}

// solo se convierten a post los valores que sean objetos
// (si Firebase responde un error o null, no se dibujan tarjetas basura)
function objectToArray(data) {
  var dataArray = [];
  if (!data || typeof data !== "object") return dataArray;
  for (var key in data) {
    if (data[key] && typeof data[key] === "object") {
      dataArray.push(data[key]);
    }
  }
  return dataArray;
}

function loadFromNetwork() {
  return fetch(url)
    .then(function (res) {
      if (!res.ok) {
        throw new Error("Firebase respondió " + res.status);
      }
      return res.json();
    })
    .then(function (data) {
      networkDataReceived = true;
      console.log("From web", data);
      updateUI(objectToArray(data));
    });
}

// 1) Red
loadFromNetwork().catch(function (err) {
  console.log("Network fetch failed, using cache if available", err);
});

// 2) Caché (IndexedDB)
if ("indexedDB" in window) {
  readAllData("posts").then(function (data) {
    if (!networkDataReceived) {
      console.log("From cache", data);
      updateUI(data);
    }
  });
}

function resetForm() {
  form.reset();
  // MDL deja la clase is-dirty en los campos; hay que limpiarla
  var fields = form.querySelectorAll(".mdl-textfield");
  for (var i = 0; i < fields.length; i++) {
    fields[i].classList.remove("is-dirty", "is-focused", "is-invalid");
  }
}

function sendData() {
  fetch("https://uteq-gram-758a9-default-rtdb.firebaseio.com/post.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      title: titleInput.value,
      location: locationInput.value,
      image:
        "https://media.tenor.com/2nCqe89AsMsAAAAe/peso-pluma-gato.png",
    }),
  }).then(function (res) {
    console.log("Sent data", res);
    updateUI();
  });
}
if (form) {
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (titleInput.value.trim() === "" || locationInput.value.trim() === "") {
      alert("Please enter valid data!");
      return;
    }

    // copiamos los valores ANTES de limpiar el formulario
    var post = {
      id: new Date().toISOString(),
      title: titleInput.value,
      location: locationInput.value,
    };

    closeCreatePostModal();

    if ("serviceWorker" in navigator && "SyncManager" in window) {
      navigator.serviceWorker.ready
        .then(function (sw) {
          return writeData("sync-posts", post).then(function () {
            return sw.sync.register("sync-new-posts");
          });
        })
        .then(function () {
          var snackbarContainer = document.querySelector("#confirmation-toast");
          var data = { message: "Your Post was saved for syncing!" };
          snackbarContainer.MaterialSnackbar.showSnackbar(data);

          // mostramos el post de inmediato (el sync lo subirá a Firebase)
          createCard(post);
          resetForm();
        })
        .catch(function (err) {
          console.log(err);
        });
    } else {
      sendData().then(resetForm);
    }
  });
}