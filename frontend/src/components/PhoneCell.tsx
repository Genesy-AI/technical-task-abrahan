import { FC } from 'react'
import { isValidPhoneNumber } from '../utils/leadFields'
import {
  isPhoneEnrichmentInProgress,
  PHONE_PROVIDER_NAMES,
  PhoneEnrichmentStatus,
  PhoneProviderId,
} from '../utils/phoneProviders'

type PhoneCellProps = {
  phoneNumber: string | null
  status: PhoneEnrichmentStatus | null
  provider: PhoneProviderId | null
}

export const PhoneCell: FC<PhoneCellProps> = ({ phoneNumber, status, provider }) => {
  if (isPhoneEnrichmentInProgress(status)) {
    return (
      <div className="flex items-center text-sm text-blue-700" role="status">
        <svg className="animate-spin mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        {status === 'RUNNING' && provider ? `Searching · ${PHONE_PROVIDER_NAMES[provider]}` : 'Queued...'}
      </div>
    )
  }

  if (phoneNumber) {
    const isValid = isValidPhoneNumber(phoneNumber)
    return (
      <div className="text-sm text-gray-900">
        {phoneNumber}
        {!isValid && (
          <span className="ml-1 text-amber-600" title="This phone number does not look valid">
            ⚠
          </span>
        )}
        {status === 'FOUND' && provider && (
          <div className="text-xs text-gray-500">via {PHONE_PROVIDER_NAMES[provider]}</div>
        )}
      </div>
    )
  }

  if (status === 'NOT_FOUND') {
    return <div className="text-sm text-gray-500 italic">No data found</div>
  }

  if (status === 'FAILED') {
    return (
      <div className="text-sm text-red-600" title="Some providers failed. Run Enrich Phone again to retry.">
        Lookup failed
      </div>
    )
  }

  return <div className="text-sm text-gray-900">-</div>
}
