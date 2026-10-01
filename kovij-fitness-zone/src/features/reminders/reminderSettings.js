/**
 * Case-collision shim, safe to delete. On Windows (case-insensitive files) the extensionless
 * import "../reminders/ReminderSettings" in settingsExtensions.js resolves `.js` before `.jsx`
 * and lands here, so this file must behave exactly like ReminderSettings.jsx.
 * Helpers live in reminderDefaults.js.
 */
export { default } from "./ReminderSettings.jsx";
