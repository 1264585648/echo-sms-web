const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const services = [
    { id: 'tg', name: 'Telegram', country: '31' },
    { id: 'wa', name: 'WhatsApp', country: '4' },
    { id: 'dr', name: 'OpenAI/ChatGPT', country: '11' }, // typically 'dr' for openai
    { id: 'ig', name: 'Instagram', country: '10' }
  ];
  await prisma.systemConfig.upsert({
    where: { key: 'SERVICES' },
    update: { value: JSON.stringify(services) },
    create: { key: 'SERVICES', value: JSON.stringify(services) }
  });
  console.log('Services updated with correct countries!');
}
run().finally(() => prisma.$disconnect());
