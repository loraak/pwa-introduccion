var shareImageButton = document.querySelector("#share-image-button");
var createPostArea = document.querySelector("#create-post");
var closeCreatePostModalButton = document.querySelector(
  "#close-create-post-modal-btn",
);
var form = document.querySelector("form");
var titleInput = document.querySelector("#title");
var locationInput = document.querySelector("#location");
var sharedMomentsArea = document.querySelector("#shared-moments");


function openCreatePostModal() {

  createPostArea.style.transform = "translateY(0)";
  if (createPostArea) {
    createPostArea.style.display = "block";
  }

  // deferredPrompt lo guarda app.js (evento beforeinstallprompt) en window
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
  createPostArea.style.transform = "translateY(100vh)";
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

function updateUI(dataArray) {
  clearCards();
  for (var i = 0; i < dataArray.length; i++) {
    createCard(dataArray[i]);
  }
}

function objectToArray(data) {
  var dataArray = [];
  for (var key in data) {
    dataArray.push(data[key]);
  }
  return dataArray;
}

var url = "https://uteq-gram-758a9-default-rtdb.firebaseio.com/post.json";
var networkDataReceived = false;

// 1) Red
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

    if ("indexedDB" in window) {
      readAllData("posts").then(function (data) {
        if (!networkDataReceived) {
          console.log("From cache", data);
          updateUI(data);
        }
      });
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
      //image:
        //"https://firebasestorage.googleapis.com/v0/b/pwa2-1a1a8.firebasestorage.app/o/sf-boat.jpg?alt=media&token=e33adc41-0a87-44fd-8df9-951dda30602f",
    }),
  }).then(function (res) {
    console.log("Sent data", res);
    updateUI();
  });
}

form.addEventListener("submit", function (event) {
  event.preventDefault();

  if (titleInput.value.trim() === "" || locationInput.value.trim() === "") {
    alert("Please enter valid data!");
    return;
  }
  closeCreatePostModal();

  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready
    .then(function (sw) {
      var post = {
        id: new Date().toISOString(),
        title: titleInput.value,
        location: locationInput.value
      };
      writeData("sync-posts", post)
      .then(function () {
        return sw.sync.register("sync-new-posts");
      })
      .then(function () {
        var snackbarContainer = document.querySelector("#confirmation-toast");
        var data = { message: "Your Post was saved for syncing!" };
        snackbarContainer.MaterialSnackbar.showSnackbar(data);
      })
      .catch(function (err) {
        console.log(err);
      });
    });
} else {
  sendData();
}
});