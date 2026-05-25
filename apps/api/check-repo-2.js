const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
BigInt.prototype.toJSON = function() { return this.toString() };
async function main() {
  const repo = await prisma.repository.findUnique({ where: { id: 'cmpjpj1v70012wvjfh726qpll' } });
  console.log('REPO:' + JSON.stringify(repo));
}
main().finally(() => prisma.$disconnect());
