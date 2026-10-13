// Push-notification channel (stub).
//
// Park'd delivers notifications in the app (stored + live over Socket.io).
// To add phone push later, implement sendPush with Firebase Cloud Messaging or
// Web Push: store each device's token on the user, then send here. Users
// opt in through notificationPrefs.push.

export async function sendPush(user, notification) {
  if (process.env.PUSH_DEBUG === "true") {
    console.log(`[push] would send to ${user._id}: ${notification.title}`);
  }
  return { delivered: false, reason: "push-not-configured" };
}
