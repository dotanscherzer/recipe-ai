import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@recipe-ai.com' },
    update: {},
    create: {
      fullName: 'Admin',
      email: 'admin@recipe-ai.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      locale: 'he',
    },
  });

  // Create default categories for admin
  const categories = [
    { name: 'ארוחות בוקר', color: '#F59E0B', icon: 'sunrise' },
    { name: 'ארוחות צהריים', color: '#EF4444', icon: 'sun' },
    { name: 'ארוחות ערב', color: '#8B5CF6', icon: 'moon' },
    { name: 'קינוחים', color: '#EC4899', icon: 'cake' },
    { name: 'חטיפים', color: '#10B981', icon: 'cookie' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: `seed-${cat.name}` },
      update: {},
      create: {
        id: `seed-${cat.name}`,
        userId: admin.id,
        ...cat,
      },
    });
  }

  // Create sample recipes
  const sampleRecipes = [
    {
      title: 'שקשוקה קלאסית',
      description: 'שקשוקה מסורתית עם ביצים ברוטב עגבניות',
      ingredients: [
        { name: 'ביצים', amount: '4', unit: 'יחידות' },
        { name: 'עגבניות מרוסקות', amount: '400', unit: 'גרם' },
        { name: 'בצל', amount: '1', unit: 'יחידה' },
        { name: 'שום', amount: '3', unit: 'שיניים' },
        { name: 'פלפל אדום', amount: '1', unit: 'יחידה' },
        { name: 'כמון', amount: '1', unit: 'כפית' },
        { name: 'פפריקה', amount: '1', unit: 'כפית' },
      ],
      steps: [
        'מחממים שמן זית במחבת רחבה על אש בינונית',
        'מטגנים את הבצל והפלפל עד שמתרככים',
        'מוסיפים שום וממשיכים לטגן דקה נוספת',
        'מוסיפים עגבניות מרוסקות, כמון ופפריקה ומבשלים 10 דקות',
        'יוצרים גומות ברוטב ושוברים לתוכן ביצים',
        'מכסים ומבשלים 5-7 דקות עד שהביצים מוכנות',
      ],
      tags: ['ישראלי', 'ארוחת בוקר', 'צמחוני'],
      prepTime: 10,
      cookTime: 20,
      servings: 2,
      difficulty: 'EASY' as const,
      cuisine: 'ישראלי',
      isAiGenerated: false,
      isPublic: true,
    },
    {
      title: 'חומוס ביתי',
      description: 'חומוס קרמי וחלק כמו במסעדה',
      ingredients: [
        { name: 'גרגירי חומוס', amount: '250', unit: 'גרם' },
        { name: 'טחינה גולמית', amount: '100', unit: 'גרם' },
        { name: 'לימון', amount: '1', unit: 'יחידה' },
        { name: 'שום', amount: '2', unit: 'שיניים' },
        { name: 'קרח', amount: '3', unit: 'קוביות' },
        { name: 'מלח', amount: '1', unit: 'כפית' },
      ],
      steps: [
        'שורים את החומוס במים למשך לילה',
        'מבשלים את החומוס עד שהוא רך מאוד (כשעה)',
        'מסננים ושומרים כוס מים מהבישול',
        'טוחנים במעבד מזון עם טחינה, לימון, שום וקרח',
        'מוסיפים מי בישול בהדרגה עד לקבלת מרקם חלק',
        'מתבלים במלח וטוחנים שוב',
      ],
      tags: ['ישראלי', 'טבעוני', 'מנה ראשונה'],
      prepTime: 15,
      cookTime: 60,
      servings: 6,
      difficulty: 'MEDIUM' as const,
      cuisine: 'ישראלי',
      isAiGenerated: false,
      isPublic: true,
    },
  ];

  for (const recipe of sampleRecipes) {
    await prisma.recipe.create({
      data: {
        ...recipe,
        createdById: admin.id,
      },
    });
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
