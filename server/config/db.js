import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export async function connectDb(uri = process.env.MONGO_URI) {
  if (!uri) {
    throw new Error('MONGO_URI is not set');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info('MongoDB connected');
  return mongoose.connection;
}
