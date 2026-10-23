
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
    throw new Error("Service account project does not match.");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DATABASE_URL
  });
console.log("Credential project:", serviceAccount.project_id);
console.log("Credential email:", serviceAccount.client_email);
console.log("Expected project: trending-delivery-lebanon");
  console.log("Firebase Admin initialized successfully.");

  const snapshot = await admin.database()
    .ref("notificationTokens")
    .once("value");

  const records = snapshot.val() || {};
  const devices = [];

  for (const [uid, userRecords] of Object.entries(records)) {
    if (!userRecords || typeof userRecords !== "object") continue;

    // Support both the older direct-token format and the current
    // UID -> deviceKey -> { token, updatedAt, userAgent } format.
    if (typeof userRecords.token === "string") {
      devices.push({ uid, token: userRecords.token });
      continue;
    }

    for (const [deviceKey, record] of Object.entries(userRecords)) {
      if (record && typeof record.token === "string" && record.token.trim()) {
        devices.push({
          uid,
          deviceKey,
          token: record.token.trim()
        });
      }
    }
  }

  console.log(`Saved device tokens found: ${devices.length}`);

  if (devices.length === 0) {
    console.log("No usable tokens found. Check the saved database structure.");
    return;
  }

  let successes = 0;
  let failures = 0;

  for (const device of devices) {
    try {
      const messageId = await admin.messaging().send({
        token: device.token,
        notification: {
          title: "Trending Delivery Lebanon — Test",
          body: "This is a test notification. No order was created."
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

      successes++;
      console.log(`PUSH ACCEPTED for device ${device.deviceKey || "default"}.`);
      console.log(`Message ID: ${messageId}`);
    } catch (error) {
      failures++;
      console.error(
        `PUSH FAILED for device ${device.deviceKey || "default"}:`,
        error.code || error.message
      );
    }
  }

  console.log(`Test finished: ${successes} accepted, ${failures} failed.`);

  if (failures > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error("PUSH TEST FAILED:", error.code || error.message);
  process.exitCode = 1;
});
