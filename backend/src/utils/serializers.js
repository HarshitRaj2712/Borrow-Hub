export function publicUser(user) {
  const plain = typeof user?.toObject === 'function' ? user.toObject() : { ...user }
  for (const field of [
    '_id',
    'passwordHash',
    'verificationTokenHash',
    'verificationTokenExpiresAt',
    'passwordResetTokenHash',
    'passwordResetTokenExpiresAt',
    'phoneOtpHash',
    'phoneOtpExpiresAt',
    'phoneOtpAttempts',
    'refreshTokenHash',
    'refreshTokenExpiresAt',
    'refreshTokens',
    'avatarPublicId',
    'tokenVersion'
  ]) delete plain[field]
  if (plain.role === 'user') plain.role = 'borrower'
  return plain
}
