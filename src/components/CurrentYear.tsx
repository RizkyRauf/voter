"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function CurrentYear() {
  const year = useSyncExternalStore(
    emptySubscribe,
    () => String(new Date().getFullYear()),
    () => "",
  );
  return <>{year}</>;
}
