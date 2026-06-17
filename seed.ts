import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Clear existing
  await prisma.sMSLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.number.deleteMany();
  await prisma.cardSecret.deleteMany();

  // Create mock card secrets
  await prisma.cardSecret.createMany({
    data: [
      { code: 'ECHO-1234-ABCD', value: 1.0, status: 'UNUSED' },
      { code: 'ECHO-5678-WXYZ', value: 5.0, status: 'UNUSED' },
    ],
  });

  // Create mock numbers
  await prisma.number.createMany({
    data: [
      { phone: '+1234567890', country: 'US', service: 'Any', status: 'AVAILABLE' },
      { phone: '+1987654321', country: 'US', service: 'WhatsApp', status: 'AVAILABLE' },
      { phone: '+447700900000', country: 'UK', service: 'Telegram', status: 'AVAILABLE' },
    ],
  });

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
