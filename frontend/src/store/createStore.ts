import { useSyncExternalStore, useCallback } from 'react';

type Listener = () => void;

export function createStore<T extends Record<string, any>>(initialState: T) {
  let state = { ...initialState };
  const listeners = new Set<Listener>();

  const getState = () => state;

  const setState = (partial: Partial<T> | ((state: T) => Partial<T>)) => {
    const nextState =
      typeof partial === 'function'
        ? (partial as (s: T) => Partial<T>)(state)
        : partial;
    state = { ...state, ...nextState };
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { getState, setState, subscribe };
}

type StoreApi<T> = {
  getState: () => T;
  setState: (p: Partial<T> | ((s: T) => Partial<T>)) => void;
  subscribe: (l: () => void) => () => void;
};

export function useStore<T, R = T>(
  store: StoreApi<T>,
  selector?: (state: T) => R,
): R {
  const getSnapshot = useCallback(() => {
    return selector ? selector(store.getState()) : (store.getState() as unknown as R);
  }, [store, selector]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
