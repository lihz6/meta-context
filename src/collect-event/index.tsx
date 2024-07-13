import React, { createContext, useCallback, useContext } from 'react';
import { useCurrent } from '../utils';

export type Params<T, P = T> = T | ((prevParams: P) => T);

export function getParams<T>(value: Params<T, void>): T;
export function getParams<T, P>(value: Params<T, P>, prevValue: P): T;
export function getParams<T, P>(value: Params<T, P | void>, prevValue?: P) {
  return { ...prevValue, ...(typeof value === 'function' ? (value as any)(prevValue) : value) };
}

export const createCollectEvent = <T extends Record<string, any>>(
  initialParams: Params<Partial<T[keyof T]>, void>,
  collectEvent: <K extends keyof T>(key: K, params?: Params<Partial<T[K]>, Partial<T[keyof T]>>) => void,
) => {
  const batch = (collect: typeof collectEvent) => {
    function batchCollectEvent<K extends keyof T>(key: K, params?: Params<Partial<T[K]>, Partial<T[keyof T]>>): void;
    function batchCollectEvent(key: Partial<{ [K in keyof T]?: Params<Partial<T[K]>, Partial<T[keyof T]>> }>): void;
    function batchCollectEvent<K extends keyof T>(
      key: K | Partial<{ [K in keyof T]?: Params<Partial<T[K]>, Partial<T[keyof T]>> }>,
      params?: Params<Partial<T[K]>, Partial<T[keyof T]>>,
    ) {
      Object.entries(typeof key === 'object' ? key : { [key]: params }).forEach(([key, params]) =>
        collect<K>(key as K, params as T[K]),
      );
    }
    return batchCollectEvent;
  };

  const CollectEvent = createContext(
    batch((key, params = {}) => collectEvent(key, getParams(params, getParams(initialParams)))),
  );

  const useCollectEvent = (params: Params<Partial<T[keyof T]>> = {}) => {
    const prevCollectEvent = useContext(CollectEvent);
    const paramsRef = useCurrent(params);
    const nextCollectEvent = batch((key, params = {}) =>
      prevCollectEvent(key, prevParams => getParams(params, getParams(paramsRef.current, prevParams))),
    );
    return useCallback(nextCollectEvent, []);
  };

  const CollectEventProvider = (props: { params: Params<Partial<T[keyof T]>>; children: React.ReactNode }) => (
    <CollectEvent.Provider value={useCollectEvent(props.params)}>{props.children}</CollectEvent.Provider>
  );

  return {
    CollectEventProvider,
    useCollectEvent,
  };
};
