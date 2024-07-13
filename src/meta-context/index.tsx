import React, { createContext, useContext, useMemo } from 'react';
import { StateChannel } from './StateChannel';
export { StateChannel } from './StateChannel';

export const createMetaContext = <T extends Record<string, StateChannel<any>>>(getMetaContext: () => T) => {
  const MetaContext = createContext(getMetaContext());
  const useMetaContext = () => {
    return useContext(MetaContext);
  };

  const MetaContextProvider = ({ children, context = {} }: { children: React.ReactNode; context?: Partial<T> }) => {
    const nextValue = { ...useMemo(getMetaContext, []), ...context };
    const keys = Object.keys(nextValue).sort() as (keyof T)[];
    return (
      <MetaContext.Provider
        value={useMemo(
          () => nextValue,
          keys.map(key => nextValue[key]),
        )}
      >
        {children}
      </MetaContext.Provider>
    );
  };
  return { useMetaContext, MetaContextProvider };
};
