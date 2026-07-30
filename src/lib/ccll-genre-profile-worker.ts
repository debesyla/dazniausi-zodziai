interface LookupMessage {
  requestId: number;
  text: string;
  productId: string;
  profileId: string;
  bucketId: number;
  recordLength: number;
  word: string;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<LookupMessage>) => void) | null;
  postMessage: (value: unknown) => void;
}

const workerScope = globalThis as unknown as WorkerScope;

workerScope.onmessage = (event) => {
  const { requestId, text, productId, profileId, bucketId, recordLength, word } = event.data;
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || value.schemaVersion !== 1 || value.productId !== productId || value.profileId !== profileId
      || value.bucketId !== bucketId || value.recordEncoding !== 'array' || !Array.isArray(value.records)) {
      throw new Error('netinkamas paieškos duomenų failo turinys');
    }
    const record = value.records.find((candidate: unknown) => Array.isArray(candidate)
      && candidate.length === recordLength && candidate[0] === word) ?? null;
    workerScope.postMessage({ requestId, record });
  } catch (cause) {
    workerScope.postMessage({
      requestId,
      error: cause instanceof Error ? cause.message : String(cause)
    });
  }
};
