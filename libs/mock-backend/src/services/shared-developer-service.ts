import { DeveloperService } from './developer.service';

/**
 * The single Developer-settings backend the running app binds (US-CW-041). Every developer handler
 * shares this instance so a key or webhook created in one request is visible to the next; it resets to
 * seed only on a full page reload. Tests never touch it — they construct isolated DeveloperService
 * instances and pass them to createDeveloperHandlers.
 */
export const sharedDeveloperService = new DeveloperService();
