import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let isConnected = false;
let isInMemory = false;

export async function connectDB() {
  if (isConnected) return;

  if (env.USE_IN_MEMORY_DB) {
    logger.info('USE_IN_MEMORY_DB is set to true. Initializing in-memory datastore.');
    isInMemory = true;
    isConnected = true;
    return;
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2500,
      maxPoolSize: 25,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    isInMemory = false;
    logger.info(`MongoDB Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    logger.warn(`Could not connect to MongoDB at ${env.MONGODB_URI}: ${error.message}.`);
    logger.info('Falling back to high-fidelity In-Memory Storage Engine for development/sandboxed mode.');
    isInMemory = true;
    isConnected = true;
  }
}

export function isDbInMemory() {
  return isInMemory || env.USE_IN_MEMORY_DB || process.env.USE_IN_MEMORY_DB === 'true';
}

export function isDbConnected() {
  return isConnected;
}

export async function disconnectDB() {
  if (isConnected && !isInMemory) {
    await mongoose.disconnect();
  }
  isConnected = false;
}
