import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRES = process.env.MEMBER_JWT_EXPIRES || '7d';

export function signMemberToken(memberDoc) {
  return jwt.sign(
    {
      memberId: memberDoc._id.toString(),
      email: memberDoc.email,
      role: memberDoc.role || 'user',
      type: 'member',
    },
    process.env.JWT_SECRET,
    { expiresIn: DEFAULT_EXPIRES }
  );
}
