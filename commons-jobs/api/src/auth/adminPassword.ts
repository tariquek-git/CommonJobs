import bcrypt from 'bcryptjs';

export const verifyAdminPassword = async (password: string, passwordHash: string): Promise<boolean> => {
  return bcrypt.compare(password, passwordHash);
};

export const hashAdminPassword = async (password: string, rounds = 12): Promise<string> => {
  return bcrypt.hash(password, rounds);
};
