const fs = require('fs');
let code = fs.readFileSync('apps/backend/prisma/seed.ts', 'utf8');

const oldDeletes = `    // Clean existing data (SQLite doesn't support TRUNCATE)
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.pricingRule.deleteMany();
    await prisma.service.deleteMany();
    await prisma.product.deleteMany();
    await prisma.court.deleteMany();
    await prisma.venueStaff.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.venue.deleteMany();
    await prisma.user.deleteMany();
    await prisma.membershipPlan.deleteMany();`;

const newDeletes = `    // Clean existing data (SQLite doesn't support TRUNCATE)
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.bookingRequest.deleteMany();
    await prisma.pricingRule.deleteMany();
    await prisma.service.deleteMany();
    await prisma.product.deleteMany();
    await prisma.court.deleteMany();
    await prisma.venueStaff.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.operatingHour.deleteMany();
    await prisma.voucher.deleteMany();
    await prisma.venue.deleteMany();
    await prisma.user.deleteMany();
    await prisma.membershipPlan.deleteMany();
    await prisma.otpRecord.deleteMany();`;

code = code.replace(oldDeletes, newDeletes);
fs.writeFileSync('apps/backend/prisma/seed.ts', code);
