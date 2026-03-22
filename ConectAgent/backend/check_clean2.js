import { PrismaClient } from '@prisma/client'; 
import fs from 'fs';
try {
  const prisma = new PrismaClient(); 
  prisma.user.findMany().then(res => {
    fs.writeFileSync('error.txt', JSON.stringify(res, null, 2));
  }).catch(e => {
    fs.writeFileSync('error.txt', e.message || String(e));
  }).finally(() => prisma.$disconnect());
} catch(e) {
  fs.writeFileSync('error.txt', e.message || String(e));
}
