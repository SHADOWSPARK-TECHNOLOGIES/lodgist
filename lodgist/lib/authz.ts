/**
 * Authorization for Next property mutations.
 *
 * Property.ownerId is a Prisma Int. NextAuth stores session.user.id as a string
 * (credentials authorize returns String(user.id)). Compare the parsed integer,
 * and allow STUDIO_ADMIN — the only admin value on the Role enum.
 */

export const STUDIO_ADMIN_ROLE = "STUDIO_ADMIN" as const;

export function canMutateProperty(input: {
  ownerId: number;
  userId: string;
  role: string | null | undefined;
}): boolean {
  if (input.role === STUDIO_ADMIN_ROLE) {
    return true;
  }

  const userId = input.userId.trim();
  if (!/^[1-9]\d*$/.test(userId)) {
    return false;
  }

  return Number(userId) === input.ownerId;
}
