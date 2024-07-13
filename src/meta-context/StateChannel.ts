import React, { useLayoutEffect, useState } from 'react';
import { removeMut } from '../utils';

type Entry<T> = {
  [K in keyof T]: [key: K, value: T[K]];
}[keyof T];

export class StateChannel<T extends Record<string, any>> {
  private subscribers: Record<keyof T, Array<(value: any) => void>> = {} as any;
  private subscriberList: Array<(...args: Entry<T>) => void> = [];
  private storage: Partial<T>;

  constructor(initialState: Partial<T> = {}) {
    this.storage = initialState;
  }

  getValue<K extends keyof T>(key?: K): typeof key extends K ? T[K] : Partial<T> {
    return (key !== undefined ? this.storage[key] : this.storage) as any;
  }

  anyValue<K extends keyof T>(key: K, consumer?: (value: T[K]) => void): Promise<T[K]> {
    return new Promise(resolve => {
      if (key in this.storage) {
        consumer?.(this.storage[key]!); // 同步
        resolve(this.storage[key]!); // 异步，微任务
      } else {
        const unsubscribeFirst = this.subscribe(key, value => {
          unsubscribeFirst();
          // 异步，宏任务
          consumer?.(value);
          resolve(value);
        });
      }
    });
  }

  useValue<V>(reducer: (store: Partial<T>, deps?: any[]) => V): V;
  useValue<K extends keyof T, V = T[K]>(key: K, reducer?: (value?: T[K]) => V, deps?: any[]): V;
  useValue<K extends keyof T, V = T[K]>(key: K | ((store: Partial<T>) => V), reducer?: (value?: T[K]) => V, deps = []) {
    const getValue = () =>
      typeof key === 'function' ? key(this.storage) : reducer ? reducer(this.storage[key]) : this.storage[key];

    const [value, setValue] = useState(getValue);

    useLayoutEffect(() => {
      setValue(getValue()); // 确保最新值已同步为状态（render到useLayoutEffect期间可能发生过更新）

      if (typeof key === 'function') {
        return this.subscribe(() => setValue(key(this.storage)));
      } else if (reducer) {
        return this.subscribe(key, value => setValue(reducer(value)));
      } else {
        return this.subscribe(key, setValue);
      }
    }, deps);

    return value;
  }

  subscribe(subscriber: (...[key, value]: Entry<T>) => void): () => void;
  subscribe<K extends keyof T>(key: K, subscriber: (value: T[K]) => void): () => void;
  subscribe<K extends keyof T>(key: K | ((...[key, value]: Entry<T>) => void), subscriber?: (value: T[K]) => void) {
    switch (typeof key) {
      case 'string':
      case 'number':
      case 'symbol':
        if (!(key in this.subscribers)) {
          this.subscribers[key] = [];
        }
        this.subscribers[key].push(subscriber!);
        return () => {
          removeMut(this.subscribers[key], subscriber);
        };
      default:
        this.subscriberList.push(key);
        return () => {
          removeMut(this.subscriberList, key);
        };
    }
  }

  dispatch(partial: Partial<T>): void;
  dispatch<K extends keyof T>(key: K, value: React.SetStateAction<T[K]>): void;
  dispatch<K extends keyof T>(key: K | Partial<T>, value?: React.SetStateAction<T[K]>) {
    if (typeof key === 'object') {
      return Object.entries(key).forEach(([key, value]) => this.dispatch(key, value));
    }
    if (
      this.storage[key] !==
      (this.storage[key] = typeof value === 'function' ? (value as any)(this.storage[key]) : value)
    ) {
      if (process.env.NODE_ENV === 'development') {
        console.groupCollapsed('dispatch', key, value);
        console.log('start', this.storage[key], this.subscribers[key]?.slice());
      }
      for (const subscriber of this.subscriberList.slice()) {
        try {
          subscriber(key, this.storage[key]!);
        } catch (error) {
          console.error(error);
        }
      }
      if (this.subscribers[key]) {
        for (const subscriber of this.subscribers[key].slice()) {
          try {
            subscriber(this.storage[key]);
          } catch (error) {
            console.error(error);
          }
        }
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('after', this.storage[key], this.subscribers[key]?.slice());
        console.trace();
      }
      if (process.env.NODE_ENV === 'development') {
        console.groupEnd();
      }
    }
  }
}
