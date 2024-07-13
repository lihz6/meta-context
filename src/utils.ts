import { useRef } from 'react';

export const removeMut = <T>(array: T[], item: T) => {
  const index = array.indexOf(item);
  if (index > -1) {
    array.splice(index, 1);
  }
  return index;
};

export const useCurrent = <T>(current: T) => {
  const ref = useRef(current);
  ref.current = current;
  return ref;
};
