
const admin = require("firebase-admin");

const PROJECT_ID = "trending-delivery-lebanon";
const DATABASE_URL =
  "https://trending-delivery-lebanon-default-rtdb.europe-west1.firebasedatabase.app/";

async function main() {
  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!rawCredentials) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON secret is missing.");
  }

  const serviceAccount = JSON.parse(rawCredentials);

  if (serviceAccount.project_id !== PROJECT_ID) {
    throw new Error(
      `Wrong service account project: ${serviceAccount.project_id}`
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DATABASE_URL
  });

  console.log("Firebase Admin initialized successfully.");

  const snapshot = await admin
    .database()
    .ref("notificationTokens")
    .once("value");

  const records = snapshot.val() || {};
  const tokens = [];

  for (const [uid, record] of Object.entries(records)) {
    if (record && typeof record.token === "string" && record.token.trim()) {
      tokens.push({ uid, token: record.token.trim() });
    }
  }

  console.log(`Saved device tokens found: ${tokens.length}`);

  if (tokens.length === 0) {
    throw new Error(
      "No usable device tokens found at notificationTokens/{uid}/token."
    );
  }

  for (const device of tokens) {
    try {
      const messageId = await admin.messaging().send({
        token: device.token,
        notification: {
          title: "Trending Delivery Lebanon — Test",
          body: "Push notifications are working. This is a test only."
        },
        data: {
          type: "notification_test",
          url: "/trending-delivery-lebanon/"
        },
        webpush: {
          fcmOptions: {
            link: "https://fedaaghanem17-gif.github.io/trending-delivery-lebanon/"
          }
        }
      });

      console.log(`SUCCESS: A push was accepted for device UID ${device.uid}.`);
      console.log(`Message ID: ${messageId}`);
    } catch (error) {
      console.error(
        `FAILED for device UID ${device.uid}:`,
        error.code || error.message
      );
      process.exitCode = 1;
    }
  }

  console.log("Push test completed.");
}

main().catch((error) => {
  console.error("PUSH TEST FAILED:", error.code || error.message);
  process.exitCode = 1;
});
