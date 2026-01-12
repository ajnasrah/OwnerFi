// Shared OTP storage
// In production, use Redis or database for multi-instance support

interface OTPEntry {
  code: string;
  expires: number;
  attempts: number;
}

// Global store - persists across API routes in the same process
const globalStore = new Map<string, OTPEntry>();

export const otpStore = {
  set: (phone: string, entry: OTPEntry) => {
    globalStore.set(phone, entry);
  },

  get: (phone: string): OTPEntry | undefined => {
    return globalStore.get(phone);
  },

  delete: (phone: string) => {
    globalStore.delete(phone);
  },

  // Cleanup expired entries periodically
  cleanup: () => {
    const now = Date.now();
    for (const [phone, entry] of globalStore.entries()) {
      if (now > entry.expires) {
        globalStore.delete(phone);
      }
    }
  }
};

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => otpStore.cleanup(), 5 * 60 * 1000);
}
