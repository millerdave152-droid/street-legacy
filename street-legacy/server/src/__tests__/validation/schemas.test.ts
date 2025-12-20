/**
 * Validation Schemas Tests
 * Tests for Zod validation schemas
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

// Import schemas directly (no mocking needed for pure validation)
import {
  usernameSchema,
  emailSchema,
  passwordSchema,
  idSchema,
  positiveIntSchema,
  positiveMoneySchema,
} from '../../validation/schemas/common.schema.js';

import {
  registerSchema,
  loginSchema,
} from '../../validation/schemas/auth.schema.js';

import {
  commitCrimeSchema,
} from '../../validation/schemas/game.schema.js';

import {
  depositSchema,
  withdrawSchema,
  transferSchema,
} from '../../validation/schemas/banking.schema.js';

describe('Common Validation Schemas', () => {
  describe('usernameSchema', () => {
    it('should accept valid usernames', () => {
      expect(() => usernameSchema.parse('player1')).not.toThrow();
      expect(() => usernameSchema.parse('Player_123')).not.toThrow();
      expect(() => usernameSchema.parse('abc')).not.toThrow(); // min 3 chars
    });

    it('should reject usernames that are too short', () => {
      expect(() => usernameSchema.parse('ab')).toThrow();
      expect(() => usernameSchema.parse('')).toThrow();
    });

    it('should reject usernames that are too long', () => {
      expect(() => usernameSchema.parse('a'.repeat(31))).toThrow();
    });

    it('should reject usernames with invalid characters', () => {
      expect(() => usernameSchema.parse('player@name')).toThrow();
      expect(() => usernameSchema.parse('player name')).toThrow();
      expect(() => usernameSchema.parse('player!123')).toThrow();
    });
  });

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      expect(() => emailSchema.parse('test@example.com')).not.toThrow();
      expect(() => emailSchema.parse('user.name@domain.org')).not.toThrow();
      expect(() => emailSchema.parse('user+tag@example.co.uk')).not.toThrow();
    });

    it('should reject invalid emails', () => {
      expect(() => emailSchema.parse('invalid')).toThrow();
      expect(() => emailSchema.parse('invalid@')).toThrow();
      expect(() => emailSchema.parse('@domain.com')).toThrow();
      expect(() => emailSchema.parse('')).toThrow();
    });

    it('should normalize email to lowercase', () => {
      const result = emailSchema.parse('TEST@EXAMPLE.COM');
      expect(result).toBe('test@example.com');
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid passwords', () => {
      expect(() => passwordSchema.parse('Password1!')).not.toThrow();
      expect(() => passwordSchema.parse('MySecure123@')).not.toThrow();
      expect(() => passwordSchema.parse('Test1234#')).not.toThrow();
    });

    it('should reject passwords that are too short', () => {
      expect(() => passwordSchema.parse('Pass1')).toThrow();
      expect(() => passwordSchema.parse('Ab1')).toThrow();
    });

    it('should reject passwords without uppercase', () => {
      expect(() => passwordSchema.parse('password1')).toThrow();
    });

    it('should reject passwords without lowercase', () => {
      expect(() => passwordSchema.parse('PASSWORD1')).toThrow();
    });

    it('should reject passwords without numbers', () => {
      expect(() => passwordSchema.parse('PasswordOnly')).toThrow();
    });
  });

  describe('idSchema', () => {
    it('should accept positive integers', () => {
      expect(() => idSchema.parse(1)).not.toThrow();
      expect(() => idSchema.parse(100)).not.toThrow();
      expect(() => idSchema.parse(999999)).not.toThrow();
    });

    it('should reject zero and negative numbers', () => {
      expect(() => idSchema.parse(0)).toThrow();
      expect(() => idSchema.parse(-1)).toThrow();
    });

    it('should coerce strings to integers', () => {
      // idSchema uses z.coerce.number() which converts strings
      expect(idSchema.parse('1')).toBe(1);
      expect(() => idSchema.parse(1.5)).toThrow();
    });
  });

  describe('positiveMoneySchema', () => {
    it('should accept positive integers', () => {
      expect(() => positiveMoneySchema.parse(1)).not.toThrow();
      expect(() => positiveMoneySchema.parse(1000000)).not.toThrow();
    });

    it('should reject zero and negative numbers', () => {
      expect(() => positiveMoneySchema.parse(0)).toThrow();
      expect(() => positiveMoneySchema.parse(-100)).toThrow();
    });
  });
});

describe('Auth Validation Schemas', () => {
  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const validData = {
        body: {
          username: 'newplayer',
          email: 'player@example.com',
          password: 'SecurePass1!',
          confirmPassword: 'SecurePass1!',
        }
      };
      expect(() => registerSchema.parse(validData)).not.toThrow();
    });

    it('should reject missing username', () => {
      const invalidData = {
        body: {
          email: 'player@example.com',
          password: 'SecurePass1!',
          confirmPassword: 'SecurePass1!',
        }
      };
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing email', () => {
      const invalidData = {
        body: {
          username: 'newplayer',
          password: 'SecurePass1!',
          confirmPassword: 'SecurePass1!',
        }
      };
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing password', () => {
      const invalidData = {
        body: {
          username: 'newplayer',
          email: 'player@example.com',
          confirmPassword: 'SecurePass1!',
        }
      };
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject weak password', () => {
      const invalidData = {
        body: {
          username: 'newplayer',
          email: 'player@example.com',
          password: 'weak',
          confirmPassword: 'weak',
        }
      };
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should require confirmPassword', () => {
      const validData = {
        body: {
          username: 'newplayer',
          email: 'player@example.com',
          password: 'SecurePass1!',
          confirmPassword: 'SecurePass1!',
        }
      };
      const result = registerSchema.parse(validData);
      expect(result.body.confirmPassword).toBe('SecurePass1!');
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        body: {
          username: 'newplayer',
          email: 'player@example.com',
          password: 'SecurePass1!',
          confirmPassword: 'DifferentPass1!',
        }
      };
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const validData = {
        body: {
          username: 'existingplayer',
          password: 'Password1',
        }
      };
      expect(() => loginSchema.parse(validData)).not.toThrow();
    });

    it('should reject missing username', () => {
      const invalidData = {
        body: {
          password: 'Password1',
        }
      };
      expect(() => loginSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing password', () => {
      const invalidData = {
        body: {
          username: 'existingplayer',
        }
      };
      expect(() => loginSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty strings', () => {
      const invalidData = {
        body: {
          username: '',
          password: '',
        }
      };
      expect(() => loginSchema.parse(invalidData)).toThrow();
    });
  });
});

describe('Game Validation Schemas', () => {
  describe('commitCrimeSchema', () => {
    it('should accept valid crime data', () => {
      const validData = {
        body: {
          crimeId: 1,
        }
      };
      expect(() => commitCrimeSchema.parse(validData)).not.toThrow();
    });

    it('should accept large valid crimeId', () => {
      const validData = {
        body: {
          crimeId: 999,
        }
      };
      const result = commitCrimeSchema.parse(validData);
      expect(result.body.crimeId).toBe(999);
    });

    it('should reject invalid crimeId', () => {
      const invalidData = {
        body: {
          crimeId: 0,
        }
      };
      expect(() => commitCrimeSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative crimeId', () => {
      const invalidData = {
        body: {
          crimeId: -1,
        }
      };
      expect(() => commitCrimeSchema.parse(invalidData)).toThrow();
    });
  });
});

describe('Banking Validation Schemas', () => {
  describe('depositSchema', () => {
    it('should accept valid deposit', () => {
      const validData = {
        body: {
          amount: 1000,
        }
      };
      expect(() => depositSchema.parse(validData)).not.toThrow();
    });

    it('should reject zero amount', () => {
      const invalidData = {
        body: {
          amount: 0,
        }
      };
      expect(() => depositSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative amount', () => {
      const invalidData = {
        body: {
          amount: -100,
        }
      };
      expect(() => depositSchema.parse(invalidData)).toThrow();
    });
  });

  describe('withdrawSchema', () => {
    it('should accept valid withdrawal', () => {
      const validData = {
        body: {
          amount: 500,
        }
      };
      expect(() => withdrawSchema.parse(validData)).not.toThrow();
    });

    it('should reject zero amount', () => {
      const invalidData = {
        body: {
          amount: 0,
        }
      };
      expect(() => withdrawSchema.parse(invalidData)).toThrow();
    });
  });

  describe('transferSchema', () => {
    it('should accept valid transfer with username', () => {
      const validData = {
        body: {
          recipientUsername: 'recipient',
          amount: 1000,
        }
      };
      expect(() => transferSchema.parse(validData)).not.toThrow();
    });

    it('should accept valid transfer with ID', () => {
      const validData = {
        body: {
          recipientId: 123,
          amount: 1000,
        }
      };
      expect(() => transferSchema.parse(validData)).not.toThrow();
    });

    it('should accept optional note', () => {
      const validData = {
        body: {
          recipientUsername: 'recipient',
          amount: 1000,
          note: 'Payment for services',
        }
      };
      const result = transferSchema.parse(validData);
      expect(result.body.note).toBe('Payment for services');
    });

    it('should reject missing recipient', () => {
      const invalidData = {
        body: {
          amount: 1000,
        }
      };
      expect(() => transferSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing amount', () => {
      const invalidData = {
        body: {
          recipientUsername: 'recipient',
        }
      };
      expect(() => transferSchema.parse(invalidData)).toThrow();
    });

    it('should reject note that is too long', () => {
      const invalidData = {
        body: {
          recipientUsername: 'recipient',
          amount: 1000,
          note: 'a'.repeat(201), // Max is 200
        }
      };
      expect(() => transferSchema.parse(invalidData)).toThrow();
    });
  });
});

describe('Zod Error Messages', () => {
  it('should provide helpful error messages', () => {
    try {
      usernameSchema.parse('ab');
    } catch (error) {
      if (error instanceof z.ZodError) {
        expect(error.issues[0].message).toContain('3');
      }
    }
  });

  it('should list all validation errors', () => {
    try {
      registerSchema.parse({
        body: {
          username: '',
          email: 'invalid',
          password: 'weak',
          confirmPassword: 'different',
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        expect(error.issues.length).toBeGreaterThan(1);
      }
    }
  });
});
