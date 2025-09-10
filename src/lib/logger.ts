import winston from 'winston';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db as firebaseDb } from './firebase';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
});

interface LogContext {
  userId?: string;
  userType?: 'buyer' | 'agent' | 'admin' | 'realtor';
  action?: string;
  metadata?: Record<string, unknown>;
}

export async function logToDatabase(
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  context?: LogContext,
  error?: Error
) {
  try {
    const id = doc(collection(firebaseDb, 'systemLogs')).id;
    await setDoc(doc(firebaseDb, 'systemLogs', id), {
      id,
      level,
      message,
      context: context ? JSON.stringify(context) : null,
      userId: context?.userId || null,
      userType: context?.userType || null,
      stackTrace: error?.stack || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (dbError) {
    logger.error('Failed to log to database:', dbError);
  }
}

export const logError = async (message: string, context?: LogContext, error?: Error) => {
  logger.error(message, { context, error });
  await logToDatabase('error', message, context, error);
};

export const logWarn = async (message: string, context?: LogContext) => {
  logger.warn(message, { context });
  await logToDatabase('warn', message, context);
};

export const logInfo = async (message: string, context?: LogContext) => {
  logger.info(message, { context });
  await logToDatabase('info', message, context);
};

export const logDebug = async (message: string, context?: LogContext) => {
  logger.debug(message, { context });
  await logToDatabase('debug', message, context);
};

export default logger;