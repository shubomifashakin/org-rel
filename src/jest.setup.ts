jest.mock('./../generated/prisma/client.js', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $connects: jest.fn(),
    })),
  };
});

jest.mock('./../generated/prisma/enums.js', () => {
  return {
    InviteStatus: {
      PENDING: 'PENDING',
      ACCEPTED: 'ACCEPTED',
      REJECTED: 'REJECTED',
    },
    Roles: {
      ADMIN: 'ADMIN',
      USER: 'USER',
    },
  };
});
