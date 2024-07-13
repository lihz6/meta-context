import React, { createContext, useContext, useEffect, useRef, MutableRefObject, useCallback } from 'react';
import { applyEvent, getBinding, Shortcut, Options } from './applyEvent';
import { removeMut, useCurrent } from '../utils';

export const createShortcut = (onMissing?: (binding: string) => void) => {
  const listeners: Array<MutableRefObject<{ shortcut: Shortcut; options: Options | undefined }>> = [];

  const onkeydown = (event: KeyboardEvent) => {
    const { isContentEditable, tagName } = event.target as HTMLElement;
    if (isContentEditable || ['input', 'textarea', 'select'].includes(tagName?.toLowerCase())) {
      return;
    }
    if (!dispatch(event, listeners)) {
      onMissing?.(getBinding(event));
    }
  };

  const dispatch = (
    event: KeyboardEvent,
    listeners: Array<MutableRefObject<{ shortcut: Shortcut; options: Options | undefined }>>,
  ) => {
    const bubbles: Array<{ shortcut: Shortcut; options: Options | undefined }> = [];
    for (const { current } of listeners) {
      if (current.options?.disabled) {
        continue;
      }
      if (!current.options?.capture) {
        bubbles.unshift(current);
      } else if (applyEvent(event, current.shortcut)) {
        return true;
      }
    }
    return bubbles.some(({ shortcut }) => applyEvent(event, shortcut));
  };

  const Context = createContext((shortcut: Shortcut, options?: Options) => {
    const listenerRef = useCurrent({ shortcut, options });
    useEffect(() => {
      if (!listeners.length) {
        document.addEventListener('keydown', onkeydown);
      }
      listeners.push(listenerRef);
      return () => {
        removeMut(listeners, listenerRef);
        if (!listeners.length) {
          document.removeEventListener('keydown', onkeydown);
        }
      };
    }, []);
  });

  const useShortcut = (shortcut: Shortcut, options?: Options) => {
    return useContext(Context)(shortcut, options);
  };

  const ShortcutProvider = ({ children, options }: { children: React.ReactNode; options?: Options }) => {
    const listenersRef = useRef<typeof listeners>([]);
    useShortcut(
      {
        '': event => {
          return dispatch(event, listenersRef.current);
        },
      },
      options,
    );

    return (
      <Context.Provider
        value={useCallback((shortcut: Shortcut, options?: Options) => {
          const listenerRef = useCurrent({ shortcut, options });
          useEffect(() => {
            listenersRef.current.push(listenerRef);
            return () => {
              removeMut(listenersRef.current, listenerRef);
            };
          }, []);
        }, [])}
      >
        {children}
      </Context.Provider>
    );
  };

  return {
    ShortcutProvider,
    useShortcut,
  };
};
