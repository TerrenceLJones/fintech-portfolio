import { BillingService } from './billing.service';

/**
 * The single Billing & Plan backend the running app binds (US-CW-042). Every billing handler shares this
 * instance so a payment-method update or a cancellation is visible to the next request — including the
 * read-only grace state the app-wide banner and write-guards read; it resets to seed only on a full page
 * reload. Tests never touch it — they construct isolated BillingService instances.
 */
export const sharedBillingService = new BillingService();
