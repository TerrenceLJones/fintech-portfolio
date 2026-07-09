import { PaymentsService } from './payments.service';

/**
 * The one PaymentsService the running app's payment handlers bind to, so a GET context, a POST
 * submission, and a subsequent GET intent all read and mutate the same in-memory state (same
 * rationale as sharedApprovalsService). State resets to the seed fixtures on a full reload, which is
 * fine for a demo; tests inject their own isolated instances via createPaymentsHandlers.
 */
export const sharedPaymentsService = new PaymentsService();
