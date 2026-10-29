import { PrismaClient } from '@prisma/client'

// Shared by the API and the Temporal activities (both run in the same process).
export const prisma = new PrismaClient()
