import { describe, expect, it } from 'vitest';
import { verifyPublicProvenance } from '../../scripts/verify-public-provenance.mjs';

describe('public provenance boundary', () => {
  it('keeps checked-in public metadata free of internal source locators', async () => {
    await expect(verifyPublicProvenance()).resolves.toMatchObject({
      jsonFiles: expect.any(Number),
      textFiles: expect.any(Number)
    });
  });
});
