import { Binding, MODIFIER_MAP, SYMBOL_MAP } from './Binding';

export type Shortcut = Partial<Record<Binding, (event: KeyboardEvent) => boolean | void>>;

export interface Options {
  disabled?: boolean;
  capture?: boolean;
}

const matchEvent = (event: KeyboardEvent, binding: string) => {
  if (!binding) {
    return true;
  }
  const modifiers = binding.split('+') as (keyof typeof MODIFIER_MAP)[];
  const code = modifiers.pop() as keyof typeof SYMBOL_MAP;

  // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
  // https://w3c.github.io/uievents/tools/key-event-viewer.html
  if (modifiers.every(modifier => event[MODIFIER_MAP[modifier]]) && (SYMBOL_MAP[code] || code) === event.code) {
    return true;
  }
  return false;
};

export const applyEvent = (event: KeyboardEvent, shortcut: Shortcut) => {
  for (const [binding, callback] of Object.entries(shortcut)) {
    if (matchEvent(event, binding)) {
      return callback(event) ?? true;
    }
  }
  return false;
};

export const getBinding = (event: KeyboardEvent) => {
  return Object.entries(MODIFIER_MAP)
    .filter(item => event[item[1]])
    .map(item => item[0])
    .sort()
    .concat(event.code)
    .join('+');
};
