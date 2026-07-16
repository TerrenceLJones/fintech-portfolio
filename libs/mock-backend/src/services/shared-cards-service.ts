import { CardsService } from './cards.service';

/**
 * The one CardsService the running app's card handlers and the feed WebSocket bind to, so a wallet
 * read, an issuance, a freeze, and the live feed all share the same in-memory state (same rationale as
 * sharedPaymentsService). State resets to the seed fixtures on a full reload, which is fine for a demo;
 * tests inject their own isolated instances via createCardsHandlers / createCardsFeedHandler.
 */
export const sharedCardsService = new CardsService();
