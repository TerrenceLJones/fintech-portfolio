import { IntegrationsService } from './integrations.service';

/**
 * The single accounting-integrations backend the running app binds (US-CW-039). Every integrations
 * handler shares this instance so a connect/sync/disconnect in one request is visible to the next; it
 * resets to seed only on a full page reload. Tests never touch it — they construct isolated
 * IntegrationsService instances and pass them to createIntegrationsHandlers.
 */
export const sharedIntegrationsService = new IntegrationsService();
