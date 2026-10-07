'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MANAGER_ROLES, requireRole } from '@/lib/tenant';
import type { UserSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { runAction, UserFacingError } from '@/lib/actionUtils';
import { listUsers } from '@/lib/data/users';
import { ROLES, type Role } from '@/lib/roles';
import type { ActionResult, ManagedUser } from '@/lib/types';

const password = z.string().min(10, 'Password must be at least 10 characters').max(200);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  role: z.enum(ROLES as [Role, ...Role[]]),
  phone: optionalText(40),
  area: optionalText(120),
  employeeCode: optionalText(40),
});

const createUserSchema = profileSchema.extend({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password,
});

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Managers may manage everyone except admins; only admins may manage or grant ADMIN. */
function assertCanManage(session: UserSession, targetRole: Role, newRole?: Role) {
  if (session.role === 'ADMIN') return;
  if (targetRole === 'ADMIN' || newRole === 'ADMIN') {
    throw new UserFacingError('Only an admin can manage admin accounts.');
  }
}

async function findOrgUser(session: UserSession, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: z.string().parse(userId), organizationId: session.organizationId } });
  if (!user) throw new UserFacingError('User not found.');
  return user;
}

async function fresh(session: UserSession): Promise<ManagedUser[]> {
  revalidatePath('/', 'layout');
  return listUsers(session);
}

export type CreateUserInput = z.input<typeof createUserSchema>;

export async function createUser(input: CreateUserInput): Promise<ActionResult<ManagedUser[]>> {
  return runAction('createUser', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const data = createUserSchema.parse(input);
    assertCanManage(session, data.role, data.role);

    const user = await prisma.user.create({
      data: {
        organizationId: session.organizationId,
        email: data.email,
        name: data.name,
        initials: initialsOf(data.name),
        role: data.role,
        phone: data.phone || null,
        area: data.area || null,
        employeeCode: data.employeeCode || null,
        passwordHash: await bcrypt.hash(data.password, 12),
      },
    });

    await audit(session, 'CREATE_USER', 'User', user.id, { email: user.email, role: user.role });
    return fresh(session);
  });
}

export type UpdateUserInput = z.input<typeof profileSchema>;

export async function updateUser(userId: string, input: UpdateUserInput): Promise<ActionResult<ManagedUser[]>> {
  return runAction('updateUser', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const target = await findOrgUser(session, userId);
    const data = profileSchema.parse(input);
    assertCanManage(session, target.role, data.role);
    if (target.id === session.userId && data.role !== target.role) {
      throw new UserFacingError('You cannot change your own role.');
    }

    await prisma.user.update({
      where: { id: target.id },
      data: {
        name: data.name,
        initials: initialsOf(data.name),
        role: data.role,
        phone: data.phone || null,
        area: data.area || null,
        employeeCode: data.employeeCode || null,
      },
    });

    await audit(session, 'UPDATE_USER', 'User', target.id, { before: { role: target.role }, after: data });
    return fresh(session);
  });
}

/** Activate or deactivate an account. Deactivation signs the user out everywhere. */
export async function setUserActive(userId: string, isActive: boolean): Promise<ActionResult<ManagedUser[]>> {
  return runAction('setUserActive', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const target = await findOrgUser(session, userId);
    assertCanManage(session, target.role);
    if (target.id === session.userId) throw new UserFacingError('You cannot deactivate your own account.');

    await prisma.user.update({
      where: { id: target.id },
      data: { isActive: z.boolean().parse(isActive), ...(isActive ? {} : { sessionVersion: { increment: 1 } }) },
    });

    await audit(session, isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'User', target.id);
    return fresh(session);
  });
}

/** Set a new password and sign the user out of all existing sessions. */
export async function resetUserPassword(userId: string, newPassword: string): Promise<ActionResult> {
  return runAction('resetUserPassword', async () => {
    const session = await requireRole(MANAGER_ROLES);
    const target = await findOrgUser(session, userId);
    assertCanManage(session, target.role);

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await bcrypt.hash(password.parse(newPassword), 12), sessionVersion: { increment: 1 } },
    });

    await audit(session, 'RESET_USER_PASSWORD', 'User', target.id);
    return undefined;
  });
}
