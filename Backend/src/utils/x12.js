const TXN_837P = '837P'
const TXN_837I = '837I'
const TXN_835 = '835'
const TXN_834 = '834'

const normalizeRaw = (raw) => raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()

export const splitSegments = (raw) => {
  const normalized = normalizeRaw(raw)
  const firstIsaIdx = normalized.indexOf('ISA')
  if (firstIsaIdx === -1) {
    return { segmentDelimiter: '~', elementDelimiter: '*', componentDelimiter: ':', segments: [] }
  }

  const isaChunk = normalized.slice(firstIsaIdx, firstIsaIdx + 120)
  const elementDelimiter = isaChunk[3] || '*'

  const segCandidates = ['~', '\n']
  let segmentDelimiter = '~'
  for (const candidate of segCandidates) {
    if (normalized.includes(`${elementDelimiter}00501${candidate}`) || normalized.includes(`IEA${candidate}`)) {
      segmentDelimiter = candidate
      break
    }
  }

  const componentDelimiter = isaChunk.length > 104 ? isaChunk[104] : ':'
  const segments = normalized
    .split(segmentDelimiter)
    .map((line) => line.trim())
    .filter(Boolean)

  return { segmentDelimiter, elementDelimiter, componentDelimiter, segments }
}

export const parseX12 = (raw) => {
  const { segmentDelimiter, elementDelimiter, componentDelimiter, segments } = splitSegments(raw)

  const parsedSegments = segments.map((segmentText, index) => {
    const parts = segmentText.split(elementDelimiter)
    return {
      index,
      id: parts[0],
      elements: parts.slice(1),
      raw: segmentText,
    }
  })

  return {
    delimiters: { segmentDelimiter, elementDelimiter, componentDelimiter },
    segments: parsedSegments,
  }
}

export const detectTransactionType = (parsed) => {
  const st = parsed.segments.find((seg) => seg.id === 'ST')
  const gs = parsed.segments.find((seg) => seg.id === 'GS')
  if (!st) return 'UNKNOWN'

  const st01 = st.elements[0] || ''
  const st03 = st.elements[2] || ''
  const gs08 = gs?.elements?.[7] || ''

  if (st01 === '837') {
    if (st03.includes('X222') || gs08.includes('X222')) return TXN_837P
    if (st03.includes('X223') || gs08.includes('X223')) return TXN_837I
    return '837'
  }
  if (st01 === '835') return TXN_835
  if (st01 === '834') return TXN_834

  return 'UNKNOWN'
}

export const extractEnvelopeMetadata = (parsed) => {
  const isa = parsed.segments.find((seg) => seg.id === 'ISA')
  const gs = parsed.segments.find((seg) => seg.id === 'GS')
  const stCount = parsed.segments.filter((seg) => seg.id === 'ST').length

  return {
    senderId: isa?.elements?.[5] || '',
    receiverId: isa?.elements?.[7] || '',
    interchangeDate: isa?.elements?.[8] || '',
    functionalGroup: gs?.elements?.[0] || '',
    implementationVersion: gs?.elements?.[7] || '',
    transactionSetCount: stCount,
  }
}

const makeNode = (name, segment = null) => ({
  name,
  segment,
  children: [],
})

export const buildHierarchy = (parsed, transactionType) => {
  const root = makeNode(`${transactionType} Transaction`)
  let currentClaimNode = null
  let currentServiceNode = null
  let currentMemberNode = null

  for (const seg of parsed.segments) {
    if (['ISA', 'GS', 'ST'].includes(seg.id)) {
      root.children.push(makeNode(`Envelope/${seg.id}`, seg))
      continue
    }

    if (transactionType.startsWith('837')) {
      if (seg.id === 'CLM') {
        currentClaimNode = makeNode(`Loop 2300 Claim ${seg.elements[0] || ''}`, seg)
        root.children.push(currentClaimNode)
        currentServiceNode = null
        continue
      }
      if (seg.id === 'SV1' || seg.id === 'SV2') {
        currentServiceNode = makeNode(`Loop 2400 Service ${seg.elements[0] || ''}`, seg)
        ;(currentClaimNode || root).children.push(currentServiceNode)
        continue
      }
      ;(currentServiceNode || currentClaimNode || root).children.push(makeNode(seg.id, seg))
      continue
    }

    if (transactionType === TXN_835) {
      if (seg.id === 'CLP') {
        currentClaimNode = makeNode(`Loop 2100 CLP ${seg.elements[0] || ''}`, seg)
        root.children.push(currentClaimNode)
        continue
      }
      ;(currentClaimNode || root).children.push(makeNode(seg.id, seg))
      continue
    }

    if (transactionType === TXN_834) {
      if (seg.id === 'INS') {
        currentMemberNode = makeNode(`Loop 2000 Member ${seg.elements[7] || seg.index}`, seg)
        root.children.push(currentMemberNode)
        continue
      }
      ;(currentMemberNode || root).children.push(makeNode(seg.id, seg))
      continue
    }

    root.children.push(makeNode(seg.id, seg))
  }

  return root
}
