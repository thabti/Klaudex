import '@testing-library/jest-dom/vitest'

// jsdom does not implement ResizeObserver; recharts (and Radix) need it.
// Provide a minimal stub so chart/component tests don't blow up at mount.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub
}
