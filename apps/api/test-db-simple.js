const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// BigInt serialization fix
BigInt.prototype.toJSON = function() { return this.toString() };

async function test() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found');
    return;
  }
  const repos = await prisma.repository.findMany({ where: { userId: user.id } });
  console.log('COUNT:' + repos.length);
  if (repos.length > 0) {
    console.log('SERIALIZED:' + JSON.stringify({ data: repos }).substring(0, 100) + '...');
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
