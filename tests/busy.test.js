import { describe, it, expect } from 'vitest';
import { busyBegin, busyLabel } from '../src/busy.js';

describe('loading tracker', () => {
  it('shows the oldest pending label and clears when all finish', () => {
    expect(busyLabel()).toBe(null);
    const a = busyBegin('Loading satellites'), b = busyBegin('Loading sharper Earth photos'), b2 = busyBegin('Loading sharper Earth photos');
    expect(busyLabel()).toBe('Loading satellites');
    a(); expect(busyLabel()).toBe('Loading sharper Earth photos');
    b(); b(); // ending twice counts once
    expect(busyLabel()).toBe('Loading sharper Earth photos');
    b2(); expect(busyLabel()).toBe(null);
  });
});
