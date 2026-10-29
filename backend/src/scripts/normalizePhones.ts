// One-off data fix: rewrites stored phone numbers in the standard format (see normalizePhoneNumber) and clears the
// ones that are not valid phone numbers. Safe to run more than once.
// Usage: pnpm normalize:phones
import { prisma } from '../db'
import { normalizePhoneNumber } from '../utils/leadFields'

async function main() {
  const leads = await prisma.lead.findMany({
    where: { phoneNumber: { not: null } },
    select: { id: true, phoneNumber: true },
  })

  let normalized = 0
  let discarded = 0
  for (const lead of leads) {
    const phoneNumber = normalizePhoneNumber(lead.phoneNumber!)
    if (phoneNumber === lead.phoneNumber) continue

    await prisma.lead.update({ where: { id: lead.id }, data: { phoneNumber } })
    console.log(
      `Lead ${lead.id}: "${lead.phoneNumber}" -> ${phoneNumber === null ? 'discarded' : `"${phoneNumber}"`}`
    )
    if (phoneNumber === null) discarded++
    else normalized++
  }

  console.log(`Checked ${leads.length} phones: ${normalized} normalized, ${discarded} discarded.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
