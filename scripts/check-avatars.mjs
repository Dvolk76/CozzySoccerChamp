#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAvatars() {
  try {
    console.log('Checking user avatars...\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        tg_user_id: true,
        avatar: true
      }
    });

    console.log(`Total users: ${users.length}\n`);
    
    const withAvatar = users.filter(u => u.avatar);
    const withoutAvatar = users.filter(u => !u.avatar);
    
    console.log(`Users WITH avatar: ${withAvatar.length}`);
    console.log(`Users WITHOUT avatar: ${withoutAvatar.length}\n`);
    
    if (withAvatar.length > 0) {
      console.log('Sample users WITH avatars:');
      withAvatar.slice(0, 5).forEach(u => {
        console.log(`  - ${u.name} (${u.tg_user_id})`);
        console.log(`    Avatar: ${u.avatar}\n`);
      });
    }
    
    if (withoutAvatar.length > 0) {
      console.log('Sample users WITHOUT avatars:');
      withoutAvatar.slice(0, 5).forEach(u => {
        console.log(`  - ${u.name} (${u.tg_user_id})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAvatars();

