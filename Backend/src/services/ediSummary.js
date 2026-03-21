export const build835Summary = (parsed) => {
  const claims = []
  let current = null

  for (const seg of parsed.segments) {
    if (seg.id === 'CLP') {
      current = {
        claimId: seg.elements[0] || '',
        claimStatus: seg.elements[1] || '',
        billedAmount: Number(seg.elements[2] || 0),
        paidAmount: Number(seg.elements[3] || 0),
        patientResponsibility: Number(seg.elements[4] || 0),
        payerClaimControlNumber: seg.elements[6] || '',
        adjustments: [],
        checkOrEftReference: '',
      }
      claims.push(current)
      continue
    }

    if (seg.id === 'CAS' && current) {
      current.adjustments.push({
        groupCode: seg.elements[0] || '',
        reasonCode: seg.elements[1] || '',
        amount: Number(seg.elements[2] || 0),
      })
      continue
    }

    if (seg.id === 'TRN' && current && !current.checkOrEftReference) {
      current.checkOrEftReference = seg.elements[1] || ''
    }
  }

  return claims
}

export const build834Summary = (parsed) => {
  const members = []
  let current = null

  for (const seg of parsed.segments) {
    if (seg.id === 'INS') {
      current = {
        maintenanceType: seg.elements[2] || '',
        relationshipCode: seg.elements[1] || '',
        status: seg.elements[0] || '',
        memberId: '',
        policyNumber: '',
        effectiveDate: '',
        terminationDate: '',
      }
      members.push(current)
      continue
    }

    if (!current) continue

    if (seg.id === 'NM1' && !current.memberId) {
      current.memberId = seg.elements[8] || ''
      continue
    }

    if (seg.id === 'REF') {
      if (seg.elements[0] === '1L') current.policyNumber = seg.elements[1] || ''
      if (seg.elements[0] === '0F' && !current.memberId) current.memberId = seg.elements[1] || ''
      continue
    }

    if (seg.id === 'DTP') {
      if (seg.elements[0] === '356') current.effectiveDate = seg.elements[2] || ''
      if (seg.elements[0] === '357') current.terminationDate = seg.elements[2] || ''
    }
  }

  return members
}
