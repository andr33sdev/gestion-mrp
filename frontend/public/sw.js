self.addEventListener("push", (e) => {
  try {
    const data = e.data.json();
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/assets/LogoConoflex.png", // Icono que aparecerá en el celular
      badge: "/assets/LogoConoflex.png",
      vibrate: [300, 100, 300], // Patrón de vibración [vibrar, pausa, vibrar]
      data: { url: "/solicitudes-ml" }, // Redirección al hacer click
    });
  } catch (err) {
    console.error("Error al procesar evento push entrante:", err);
  }
});

// Hacer que al tocar la notificación el celular abra la webapp directamente
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (let client of windowClients) {
          if (
            client.url.includes(e.notification.data.url) &&
            "focus" in client
          ) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(e.notification.data.url);
        }
      }),
  );
});
