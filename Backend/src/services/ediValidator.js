import { helpers, isValidNpi } from '../utils/validators.js'

const groupCodes835 = new Set(['PR', 'CO', 'OA', 'PI'])
const insMaintenanceCodes = new Set(['001', '021', '024', '025', '026', '030', '032'])
const memberRelationshipCodes = new Set(['18', '19', '20', '21', '01', '53'])
const nm108Allowed = new Set(['XX', 'FI', '34', '46', '24', 'MI'])

const error = (severity, code, message, segment, elementPosition, suggestion) => ({
  id: `${segment.id}-${segment.index}-${code}-${elementPosition || 0}`,
  severity,
  code,
  message,
  loopLocation: segment.index,
  segmentId: segment.id,
  elementPosition: elementPosition || null,
  suggestion,
})

const findSegments = (segments, id) => segments.filter((seg) => seg.id === id)

export const validateEdi = (parsed, transactionType) => {
  const errors = []
  const warnings = []
  const segments = parsed.segments

  const mustHave = ['ISA', 'GS', 'ST', 'SE', 'GE', 'IEA']
  for (const id of mustHave) {
    if (!segments.some((seg) => seg.id === id)) {
      errors.push({
        id: `missing-${id}`,
        severity: 'error',
        code: 'MISSING_SEGMENT',
        message: `Missing required segment ${id}`,
        loopLocation: null,
        segmentId: id,
        elementPosition: null,
      })
    }
  }

  for (const seg of findSegments(segments, 'NM1')) {
    const qualifier = seg.elements[7]
    const identifier = seg.elements[8]

    if (qualifier && !nm108Allowed.has(qualifier)) {
      errors.push(error('error', 'INVALID_QUALIFIER', `NM108 invalid qualifier: ${qualifier}`, seg, 8))
    }

    if (qualifier === 'XX' && identifier && !isValidNpi(identifier)) {
      errors.push(
        error('error', 'INVALID_NPI', `NPI must be valid 10-digit Luhn value: ${identifier}`, seg, 9, {
          fixType: 'replace_element',
          segmentIndex: seg.index,
          elementIndex: 8,
          correctedValue: identifier.slice(0, 9).padEnd(9, '0') + '3',
          reason: 'Provide a valid 10-digit NPI passing checksum',
        }),
      )
    }
  }

  for (const seg of findSegments(segments, 'N4')) {
    const zip = seg.elements[2]
    if (zip && !helpers.isValidZip(zip)) {
      errors.push(error('error', 'INVALID_ZIP', `ZIP must be 12345 or 12345-6789, got ${zip}`, seg, 3))
    }
  }

  for (const seg of [...findSegments(segments, 'DTP'), ...findSegments(segments, 'DMG')]) {
    const dateVal = seg.id === 'DTP' ? seg.elements[2] : seg.elements[1]
    if (dateVal && !helpers.isValidDateYYYYMMDD(dateVal)) {
      errors.push(error('error', 'INVALID_DATE', `Date must be CCYYMMDD format, got ${dateVal}`, seg, seg.id === 'DTP' ? 3 : 2))
    }
  }

  const amountSegments = ['CLM', 'SV1', 'SV2', 'SVC', 'CLP']
  for (const seg of segments.filter((s) => amountSegments.includes(s.id))) {
    const amountIndexes = seg.id === 'CLM' ? [1] : seg.id === 'CLP' ? [2, 3] : [1, 2]
    for (const idx of amountIndexes) {
      const val = seg.elements[idx]
      if (val && !helpers.isValidMoney(val)) {
        errors.push(error('error', 'INVALID_MONEY', `Invalid monetary value ${val}`, seg, idx + 1))
      }
    }
  }

  if (transactionType.startsWith('837')) {
    validate837(segments, errors, warnings)
  }

  if (transactionType === '835') {
    validate835(segments, errors)
  }

  if (transactionType === '834') {
    validate834(segments, errors, warnings)
  }

  return {
    errors,
    warnings,
    allIssues: [...errors, ...warnings],
  }
}

function validate837(segments, errors, warnings) {
  const clmSegments = findSegments(segments, 'CLM')
  if (clmSegments.length === 0) {
    errors.push({
      id: 'missing-clm',
      severity: 'error',
      code: 'MISSING_SEGMENT',
      message: '837 requires at least one CLM claim segment',
      loopLocation: null,
      segmentId: 'CLM',
      elementPosition: null,
    })
  }

  for (const clm of clmSegments) {
    const clm05 = clm.elements[4]
    if (clm05) {
      const [facilityType, _, frequency] = clm05.split(':')
      if (facilityType && !/^\d{2}$/.test(facilityType)) {
        errors.push(error('error', 'INVALID_CLM05', `CLM05 facility type must be two digits, got ${facilityType}`, clm, 5))
      }
      if (frequency && !/^\d$/.test(frequency)) {
        errors.push(error('error', 'INVALID_CLM05', `CLM05 frequency must be one digit, got ${frequency}`, clm, 5))
      }
    }

    const claimAmount = Number(clm.elements[1] || 0)
    let serviceSum = 0
    for (let i = clm.index + 1; i < segments.length; i++) {
      if (segments[i].id === 'CLM') break
      if (segments[i].id === 'SV1' || segments[i].id === 'SV2') {
        serviceSum += Number(segments[i].elements[1] || 0)
        const svc01 = segments[i].elements[0] || ''
        if (!helpers.isValidCpt(svc01)) {
          warnings.push(error('warning', 'INVALID_SVC01', `SVC01/CPT-HCPCS pattern expected (e.g., HC:99213), got ${svc01}`, segments[i], 1))
        }
      }
    }

    if (claimAmount > 0 && serviceSum > 0 && Math.abs(claimAmount - serviceSum) > 0.01) {
      errors.push(
        error('error', 'CLAIM_TOTAL_MISMATCH', `CLM02 ${claimAmount} does not match service line sum ${serviceSum.toFixed(2)}`, clm, 2, {
          fixType: 'replace_element',
          segmentIndex: clm.index,
          elementIndex: 1,
          correctedValue: serviceSum.toFixed(2),
          reason: 'Set CLM02 equal to sum of service line charges',
        }),
      )
    }
  }

  const dobSegment = segments.find((seg) => seg.id === 'DMG' && seg.elements[0] === 'D8')
  const claimDateSegment = segments.find((seg) => seg.id === 'DTP' && (seg.elements[0] === '434' || seg.elements[0] === '472'))
  if (dobSegment && claimDateSegment) {
    const dob = dobSegment.elements[1]
    const claimDate = claimDateSegment.elements[2]
    if (/^\d{8}$/.test(dob) && /^\d{8}$/.test(claimDate) && claimDate < dob) {
      errors.push(error('error', 'DOB_CLAIM_DATE_INCONSISTENT', `Claim/service date ${claimDate} cannot be before DOB ${dob}`, claimDateSegment, 3))
    }
  }
}

function validate835(segments, errors) {
  if (!segments.some((seg) => seg.id === 'BPR')) {
    errors.push({
      id: 'missing-bpr',
      severity: 'error',
      code: 'MISSING_SEGMENT',
      message: '835 requires BPR segment',
      loopLocation: null,
      segmentId: 'BPR',
      elementPosition: null,
    })
  }

  for (const cas of findSegments(segments, 'CAS')) {
    const groupCode = cas.elements[0]
    if (groupCode && !groupCodes835.has(groupCode)) {
      errors.push(error('error', 'INVALID_CAS_GROUP', `CAS group code must be PR/CO/OA/PI, got ${groupCode}`, cas, 1))
    }
  }

  for (const clp of findSegments(segments, 'CLP')) {
    const billed = Number(clp.elements[2] || 0)
    const paid = Number(clp.elements[3] || 0)
    if (paid > billed) {
      errors.push(error('error', 'CLP_RECON_FAIL', `CLP paid amount ${paid} cannot exceed billed amount ${billed}`, clp, 4))
    }
  }
}

function validate834(segments, errors, warnings) {
  if (!segments.some((seg) => seg.id === 'INS')) {
    errors.push({
      id: 'missing-ins',
      severity: 'error',
      code: 'MISSING_SEGMENT',
      message: '834 requires at least one INS segment',
      loopLocation: null,
      segmentId: 'INS',
      elementPosition: null,
    })
    return
  }

  const memberKeys = new Set()
  let currentMemberId = ''
  let currentEffDate = ''

  for (const seg of segments) {
    if (seg.id === 'INS') {
      const maintenanceCode = seg.elements[2]
      const relationshipCode = seg.elements[1]
      if (maintenanceCode && !insMaintenanceCodes.has(maintenanceCode)) {
        errors.push(error('error', 'INVALID_INS_MAINTENANCE', `INS03 maintenance type invalid: ${maintenanceCode}`, seg, 3))
      }
      if (relationshipCode && !memberRelationshipCodes.has(relationshipCode)) {
        errors.push(error('error', 'INVALID_MEMBER_REL', `INS02 relationship code invalid: ${relationshipCode}`, seg, 2))
      }
      currentEffDate = ''
      continue
    }

    if (seg.id === 'REF' && ['0F', '1L', '17'].includes(seg.elements[0])) {
      currentMemberId = seg.elements[1] || ''
      if (currentMemberId) {
        if (memberKeys.has(currentMemberId)) {
          warnings.push(error('warning', 'DUPLICATE_MEMBER', `Duplicate member reference ID detected: ${currentMemberId}`, seg, 2))
        } else {
          memberKeys.add(currentMemberId)
        }
      }
    }

    if (seg.id === 'DTP') {
      const qualifier = seg.elements[0]
      const dateValue = seg.elements[2]
      if (qualifier === '356') currentEffDate = dateValue
      if (qualifier === '357' && currentEffDate && dateValue < currentEffDate) {
        errors.push(error('error', 'DATE_RANGE_INVALID', `Coverage end date ${dateValue} is before effective date ${currentEffDate}`, seg, 3))
      }
    }
  }
}
