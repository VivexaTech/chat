import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock-object-url';
}

if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}

if (typeof Element !== 'undefined' && typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function scrollToMock() {};
}
