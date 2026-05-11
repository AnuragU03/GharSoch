import { runMatchmaker } from '../matchmaker';
import { runAgent } from '@/lib/runAgent';
import { ObjectId } from 'mongodb';

// Mock the runAgent function to capture and call the handler
jest.mock('@/lib/runAgent', () => ({
  runAgent: jest.fn(),
}));

describe('Matchmaker Agent Logic', () => {
  it('B12 part 2: returns zero matches and skips GPT call when no exact-location properties exist', async () => {
    // 1. Setup mock data
    const mockLeads = [
      { _id: new ObjectId(), name: 'Anurag', location_pref: 'Indiranagar', budget_range: '1.5 Cr', status: 'new' },
    ];
    const mockProperties = [
      { _id: new ObjectId(), title: 'Whitefield House', location: 'Whitefield, Bangalore', status: 'available' },
    ];

    // 2. Mock runAgent implementation to execute the handler
    let capturedHandler: any;
    (runAgent as jest.Mock).mockImplementation(async (opts) => {
      capturedHandler = opts.handler;
      // We don't need to return a full runId/output for this internal logic test
      return { runId: 'test-run', output: {} };
    });

    // 3. Trigger runMatchmaker to capture the handler
    await runMatchmaker();

    // 4. Mock the context
    const gptSpy = jest.fn();
    const mockCtx = {
      db: {
        findMany: jest.fn().mockImplementation((collection) => {
          if (collection === 'leads') return mockLeads;
          if (collection === 'properties') return mockProperties;
          return [];
        }),
        updateOne: jest.fn(),
        insertOne: jest.fn(),
      },
      openai: {
        chat: gptSpy,
      },
      think: jest.fn(),
      act: jest.fn(),
      kb: {
        searchBuilders: jest.fn(),
      },
    };

    // 5. Run the handler directly
    const result = await capturedHandler(mockCtx);

    // 6. Assertions
    expect(result.matches_found).toBe(0);
    expect(gptSpy).not.toHaveBeenCalled(); // CRITICAL: No GPT call should be made
    expect(mockCtx.think).toHaveBeenCalledWith(
      'decision',
      expect.stringContaining('skipping 1 lead(s), no GPT call made'),
      expect.any(Object)
    );
  });
});
