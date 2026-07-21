import { OrgNotificationsService } from './org-notifications.service';

/**
 * The single org-notification-routing backend the running app binds (US-CW-039). Every
 * org-notifications handler shares this instance so a recipient add/remove or frequency change in one
 * request is visible to the next; it resets to seed only on a full page reload. Tests never touch it —
 * they construct isolated OrgNotificationsService instances and pass them to the handler factory.
 */
export const sharedOrgNotificationsService = new OrgNotificationsService();
