import mongoose from 'mongoose';

/**
 * Run `fn(session)` inside a MongoDB transaction and return its result.
 * `fn` may be re-invoked on transient errors, so it must only write through `session`.
 * Side effects that must not repeat (emails) belong after this call resolves.
 */
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export const isObjectId = (value) => mongoose.isValidObjectId(value) && String(new mongoose.Types.ObjectId(value)) === String(value);

export const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));
