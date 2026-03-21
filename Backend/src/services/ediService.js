import { EdiDocument } from '../models/EdiDocument.js'
import { build834Summary, build835Summary } from './ediSummary.js'
import { validateEdi } from './ediValidator.js'
import { buildHierarchy, detectTransactionType, extractEnvelopeMetadata, parseX12 } from '../utils/x12.js'

const supportedExtensions = new Set(['.edi', '.txt', '.dat', '.x12'])

export const ensureSupportedExtension = (fileName) => {
  const dot = fileName.lastIndexOf('.')
  const extension = dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
  if (!supportedExtensions.has(extension)) {
    throw new Error('Unsupported file type. Allowed: .edi, .txt, .dat, .x12')
  }
}

const analyzeContent = (rawContent) => {
  const parsed = parseX12(rawContent)
  const transactionType = detectTransactionType(parsed)
  const envelopeMetadata = extractEnvelopeMetadata(parsed)
  const hierarchy = buildHierarchy(parsed, transactionType)
  const validation = validateEdi(parsed, transactionType)

  const summaries = {
    remittance835: transactionType === '835' ? build835Summary(parsed) : [],
    members834: transactionType === '834' ? build834Summary(parsed) : [],
  }

  return {
    transactionType,
    envelopeMetadata,
    parsed,
    hierarchy,
    errors: validation.errors,
    warnings: validation.warnings,
    summaries,
  }
}

export const processEdiFile = async ({ fileName, rawContent }) => {
  ensureSupportedExtension(fileName)
  const analysis = analyzeContent(rawContent)

  const doc = await EdiDocument.create({
    fileName,
    fileType: 'x12',
    transactionType: analysis.transactionType,
    envelopeMetadata: analysis.envelopeMetadata,
    rawContent,
    parsed: analysis.parsed,
    hierarchy: analysis.hierarchy,
    errors: analysis.errors,
    warnings: analysis.warnings,
    summaries: analysis.summaries,
  })

  return {
    documentId: doc.id,
    ...analysis,
  }
}

export const revalidateWithFix = async ({ documentId, suggestion }) => {
  const doc = await EdiDocument.findById(documentId)
  if (!doc) {
    throw new Error('Document not found')
  }

  if (!suggestion || suggestion.fixType !== 'replace_element') {
    throw new Error('Invalid suggestion payload')
  }

  const parsed = parseX12(doc.rawContent)
  const seg = parsed.segments[suggestion.segmentIndex]
  if (!seg) throw new Error('Invalid segment index')

  seg.elements[suggestion.elementIndex] = suggestion.correctedValue
  const rebuilt = parsed.segments
    .map((segment) => [segment.id, ...segment.elements].join(parsed.delimiters.elementDelimiter))
    .join(parsed.delimiters.segmentDelimiter)

  const analysis = analyzeContent(rebuilt)

  doc.rawContent = rebuilt
  doc.transactionType = analysis.transactionType
  doc.envelopeMetadata = analysis.envelopeMetadata
  doc.parsed = analysis.parsed
  doc.hierarchy = analysis.hierarchy
  doc.errors = analysis.errors
  doc.warnings = analysis.warnings
  doc.summaries = analysis.summaries
  await doc.save()

  return {
    documentId: doc.id,
    ...analysis,
  }
}
