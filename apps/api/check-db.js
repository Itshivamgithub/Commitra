const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.repository.count();
  console.log('REPO_COUNT:' + count);
  const repos = await prisma.repository.findMany({ take: 5, select: { name: true, fullName: true, userId: true } });
  console.log('REPOS:' + JSON.stringify(repos));
  const user = await prisma.user.findFirst();
  console.log('USER:' + JSON.stringify(user ? { id: user.id, username: user.username } : null));
}
main().catch(console.error).finally(() => prisma.$disconnect());
