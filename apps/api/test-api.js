const { reposService } = require('./src/modules/repos/repos.service');
const { prisma } = require('./src/lib/prisma');
const logger = require('./src/lib/logger');

async function test() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found');
    return;
  }
  console.log('Testing for user: ' + user.username + ' (' + user.id + ')');
  const repos = await reposService.getUserRepos(user.id, {});
  console.log('RESULT_COUNT:' + repos.length);
  if (repos.length > 0) {
    console.log('FIRST_REPO:' + JSON.stringify(repos[0]));
    try {
      console.log('SERIALIZED:' + JSON.stringify({ data: repos }));
    } catch (e) {
      console.log('SERIALIZATION_ERROR:' + e.message);
    }
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
