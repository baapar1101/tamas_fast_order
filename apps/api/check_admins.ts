import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const admins = await p.user.findMany({
    where: { role: 'admin' },
    select: { id: true, phone: true, name: true, lastName: true, role: true },
  });
  console.log('Admin users:', JSON.stringify(admins, null, 2));

  // Check if 09901046596 exists
  const target = await p.user.findFirst({
    where: { phone: '09901046596' },
    select: { id: true, phone: true, name: true, lastName: true, role: true },
  });
  console.log('Target phone 09901046596:', JSON.stringify(target, null, 2));

  // If target exists but not admin, update
  if (target && target.role !== 'admin') {
    await p.user.update({
      where: { id: target.id },
      data: { role: 'admin' },
    });
    console.log('Updated to admin!');
  } else if (!target) {
    console.log('User 09901046596 does not exist yet. They need to register first.');
  } else {
    console.log('Already admin.');
  }
}

main().catch(console.error).finally(() => p.$disconnect());
