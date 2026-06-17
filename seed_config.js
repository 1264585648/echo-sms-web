const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  await prisma.systemConfig.upsert({
    where: { key: 'HERO_API_KEY' },
    update: { value: 'test_fake_api_key' },
    create: { key: 'HERO_API_KEY', value: 'test_fake_api_key' }
  });
  await prisma.systemConfig.upsert({
    where: { key: 'EXCHANGE_RATE' },
    update: { value: '0.08' },
    create: { key: 'EXCHANGE_RATE', value: '0.08' }
  });
  await prisma.systemConfig.upsert({
    where: { key: 'SERVICES' },
    update: { value: JSON.stringify([{ id: 'tg', name: 'Telegram', country: '0' }]) },
    create: { key: 'SERVICES', value: JSON.stringify([{ id: 'tg', name: 'Telegram', country: '0' }]) }
  });
  
  // also add a fake card secret
  await prisma.cardSecret.upsert({
    where: { code: 'TESTCARD' },
    update: { value: 100, status: 'UNUSED' },
    create: { code: 'TESTCARD', value: 100, status: 'UNUSED' }
  });

  const configs = await prisma.systemConfig.findMany();
  console.log('Configs created:', configs);
}

test().finally(() => prisma.$disconnect());
