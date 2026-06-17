const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const services = [
    { id: 'tg', name: 'Telegram' },
    { id: 'wa', name: 'WhatsApp' },
    { id: 'dr', name: 'OpenAI/ChatGPT' },
    { id: 'ig', name: 'Instagram' }
  ];

  const countries = [
    { id: '0', name: '俄罗斯', flag: '🇷🇺' },
    { id: '1', name: '乌克兰', flag: '🇺🇦' },
    { id: '2', name: '哈萨克斯坦', flag: '🇰🇿' },
    { id: '4', name: '菲律宾', flag: '🇵🇭' },
    { id: '10', name: '越南', flag: '🇻🇳' },
    { id: '31', name: '南非', flag: '🇿🇦' },
  ];

  await prisma.systemConfig.upsert({
    where: { key: 'SERVICES' },
    update: { value: JSON.stringify(services) },
    create: { key: 'SERVICES', value: JSON.stringify(services) }
  });

  await prisma.systemConfig.upsert({
    where: { key: 'COUNTRIES' },
    update: { value: JSON.stringify(countries) },
    create: { key: 'COUNTRIES', value: JSON.stringify(countries) }
  });

  console.log('Seed config updated with separated services and countries!');
}

run().finally(() => prisma.$disconnect());
