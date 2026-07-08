import { createContext } from 'react';

/**
 * Lets a page rendered under AppChrome override the shell's page heading (and, in lockstep, the
 * browser tab) for its route. The default heading is the role-scoped nav label for the active section
 * (US-CW-006); a page only speaks up through usePageTitle when it wants something different — e.g. a
 * data-derived title. AppChrome owns the state and provides this setter; it is null outside AppChrome
 * (the auth pages), where usePageTitle writes document.title itself instead.
 */
export type PageTitleSetter = (title: string | undefined) => void;

export const PageTitleSetterContext = createContext<PageTitleSetter | null>(null);
