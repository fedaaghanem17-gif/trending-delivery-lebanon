const admin = require("firebase-admin");

const ADMIN_UID = "DFhtTjondXQkIhaC4YwVJp5VUr12";
const DATABASE_URL =
  "https://trending-delivery-lebanon-default-rtdb.europe-west1.firebasedatabase.app/";
const SITE_URL =
  "https://fedaaghanem17-gif.github.io/trending-delivery-lebanon/";

async function main() {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawKey) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON secret.");

  const serviceAccount = JSON.parse(rawKey);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DATABASE_URL,
  });

  const db = admin.database();
  const messaging = admin.messaging();

  async function notifyUid(uid, title, body, orderId) {
    if (!uid) {
      console.log(`SKIPPED ${title}: missing user UID.`);
      return;
    }

    const tokenSnap = await db.ref(`notificationTokens/${uid}`).get();

    if (!tokenSnap.exists()) {
      console.log(`SKIPPED ${title}: no tokens for UID ${uid}.`);
      return;
    }

    const tokens = [];
    tokenSnap.forEach((device) => {
      const token = device.child("token").val();
      if (token) tokens.push(token);
    });

    if (!tokens.length) {
      console.log(`SKIPPED ${title}: no saved device tokens.`);
      return;
    }

    console.log(`Sending "${title}" to ${tokens.length} device(s).`);

    for (let i = 0; i < tokens.length; i += 500) {
      const result = await messaging.sendEachForMulticast({
        tokens: tokens.slice(i, i + 500),
        notification: { title, body },
        data: { orderId: String(orderId || "") },
        webpush: {
          notification: {
            title,
            body,
            icon: "/trending-delivery-lebanon/icon.svg",
          },
          fcmOptions: { link: SITE_URL },
        },
      });

      console.log(
        `Push results: ${result.successCount} sent, ${result.failureCount} failed.`
      );

      result.responses.forEach((response, index) => {
        if (!response.success) {
          console.log(
            `Token ${i + index} failed: ${response.error?.code || response.error?.message}`
          );
        }
      });
    }
  }

  const ordersSnap = await db.ref("orders").get();

  if (!ordersSnap.exists()) {
    console.log("No orders found.");
    return;
  }

  for (const [key, order] of Object.entries(ordersSnap.val())) {
    if (!order || typeof order !== "object") continue;

    const orderId = order.id || key;
    const customerUid = order.customerUid || "";
    const status = String(order.status || "");
    const fee = String(order.fee ?? "");
    const decision = String(
      order.customerDecision ?? order.priceDecision ?? order.priceStatus ?? ""
    );

    const stateRef = db.ref(`notificationState/${key}`);
    const previousSnap = await stateRef.get();
    const previous = previousSnap.val();

    const current = { status, fee, decision, customerUid };

    if (!previous) {
      const rawCreated = order.createdAt || order.created || 0;
      const created =
        typeof rawCreated === "number"
          ? rawCreated
          : Date.parse(String(rawCreated));
      const recent =
        Number.isFinite(created) &&
        created > 0 &&
        Date.now() - created < 24 * 60 * 60 * 1000;

      if (recent) {
        await notifyUid(
          ADMIN_UID,
          "New delivery order",
          `Order ${orderId} has been received.`,
          orderId
        );
      } else {
        console.log(`Order ${orderId}: older than 24 hours or missing date.`);
      }

      await stateRef.set(current);
      console.log(`Saved notification state for order ${orderId}.`);
      continue;
    }

    if (previous.fee !== fee && fee !== "") {
      await notifyUid(
        customerUid,
        "Delivery price updated",
        `The delivery fee for order ${orderId} is ${fee}. Please check your order.`,
        orderId
      );
    }

    if (previous.status !== status && status !== "") {
      await notifyUid(
        customerUid,
        "Order status updated",
        `Order ${orderId}: ${status}.`,
        orderId
      );
    }

    if (previous.decision !== decision && decision !== "") {
      await notifyUid(
        ADMIN_UID,
        "Customer response received",
        `A customer response was recorded for order ${orderId}: ${decision}.`,
        orderId
      );
    }

    await stateRef.set(current);
    console.log(`Updated notification state for order ${orderId}.`);
  }

  console.log("Notification check completed.");
}

main().catch((error) => {
  console.error("NOTIFICATION SCRIPT FAILED:", error);
  process.exit(1);
});
