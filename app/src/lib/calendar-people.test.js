import { describe, it, expect } from 'vitest';
import {
  HIDDEN_PEOPLE, isHiddenPerson, isHiddenEvent, visibleEvents, visibleRoster, visibleSections,
} from './calendar-people.js';

describe('calendar-people', () => {
  it('hides Tim and Caroline, keeps Family and anyone else', () => {
    expect(HIDDEN_PEOPLE).toEqual(['Tim', 'Caroline']);
    expect(isHiddenPerson('Tim')).toBe(true);
    expect(isHiddenPerson('caroline')).toBe(true); // case-insensitive
    expect(isHiddenPerson('Family')).toBe(false);
    expect(isHiddenPerson('Mabel')).toBe(false);
  });

  it('hides a person\'s parenthesized work feed but never a longer name', () => {
    expect(isHiddenPerson('Tim (Work)')).toBe(true);
    expect(isHiddenPerson('Caroline (Work)')).toBe(true);
    expect(isHiddenPerson('Timothy')).toBe(false); // no suffix stripped → no match
    expect(isHiddenPerson('Timmy')).toBe(false);
  });

  it('isHiddenEvent resolves via person then calendar', () => {
    expect(isHiddenEvent({ person: 'Tim', calendar: 'Tim (Work)' })).toBe(true);
    expect(isHiddenEvent({ calendar: 'Caroline (Work)' })).toBe(true); // no person → calendar
    expect(isHiddenEvent({ person: 'Family', calendar: 'Family' })).toBe(false);
  });

  it('visibleEvents drops hidden people, keeps the rest', () => {
    const events = [
      { id: 'f', person: 'Family' },
      { id: 't', person: 'Tim' },
      { id: 'cw', calendar: 'Caroline (Work)', person: 'Caroline' },
      { id: 'z', person: 'Zoe' },
    ];
    expect(visibleEvents(events).map(e => e.id)).toEqual(['f', 'z']);
    expect(visibleEvents(null)).toEqual([]);
  });

  it('visibleRoster filters label lists', () => {
    expect(visibleRoster(['Family', 'Tim', 'Caroline'])).toEqual(['Family']);
    expect(visibleRoster(['Family', 'Zoe'])).toEqual(['Family', 'Zoe']);
  });

  it('visibleSections drops hidden sections and scrubs stray hidden events', () => {
    const sections = [
      { label: 'Family', events: [{ id: 'f', person: 'Family' }, { id: 'stray', person: 'Tim' }] },
      { label: 'Tim', events: [{ id: 't', person: 'Tim' }] },
    ];
    const out = visibleSections(sections);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('Family');
    expect(out[0].events.map(e => e.id)).toEqual(['f']); // stray Tim event scrubbed
  });
});
