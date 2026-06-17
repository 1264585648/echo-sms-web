import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  // First clear old unused data if any
  await db.cardSecret.deleteMany({ where: { code: 'ECHO-TEST-100' } });
  
  const secret = await db.cardSecret.create({
    data: {
      code: 'ECHO-TEST-100',
      value: 10.0,
      status: 'UNUSED'
    }
  });
  
  const number = await db.number.create({
    data: {
      phone: '+1 555-999-0000',
      country: 'US',
      service: 'Telegram',
      status: 'AVAILABLE'
    }
  });
  console.log("Created card:", secret.code);
  console.log("Created number:", number.phone, "with ID:", number.id);
}

main().catch(console.error).finally(() => db.$disconnect());
