importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAHUs-Ah3IxcM7Z4_w9zuKQ0gqkRJYJN2s",
  authDomain: "trending-delivery-lebanon.firebaseapp.com",
  databaseURL: "https://trending-delivery-lebanon-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "trending-delivery-lebanon",
  storageBucket: "trending-delivery-lebanon.firebasestorage.app",
  messagingSenderId: "392862222633",
  appId: "1:392862222633:web:eef8cf08cb62d29dc14f38"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Trending Delivery Lebanon";
  const options = {
    body: payload.notification?.body || "You have an order update.",
    icon: "/trending-delivery-lebanon/icon.png",
    data: { url: "/trending-delivery-lebanon/" }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/trending-delivery-lebanon/")
  );
});
