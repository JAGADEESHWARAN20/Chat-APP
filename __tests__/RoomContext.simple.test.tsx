// Simple test to verify Jest setup works
import { extractPresenceDataForTest } from '../lib/store/unused/RoomContext';

describe('RoomContext Basic Tests', () => {
  test('extractPresenceDataForTest function exists', () => {
    expect(typeof extractPresenceDataForTest).toBe('function');
  });

  test('handles empty presence state', () => {
    const result = extractPresenceDataForTest({});
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  test('extracts basic presence data', () => {
    const mockState = {
      'room-1': [
        {
          user_id: 'user1',
          display_name: 'User One'
        }
      ]
    };

    const result = extractPresenceDataForTest(mockState as any);
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe('user1');
    expect(result[0].display_name).toBe('User One');
  });
});