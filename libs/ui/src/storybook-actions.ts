import { fn } from 'storybook/test';

/** A `fn()` spy that also alerts, so a human clicking the story sees feedback while `play` assertions on the call still work. */
export function alertingAction<Args extends unknown[]>(
  message: string | ((...args: Args) => string),
) {
  return fn((...args: Args) => {
    window.alert(typeof message === 'function' ? message(...args) : message);
  });
}
