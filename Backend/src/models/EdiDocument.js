import mongoose from 'mongoose'

const issueSchema = new mongoose.Schema(
  {
    id: String,
    severity: String,
    code: String,
    message: String,
    loopLocation: Number,
    segmentId: String,
    elementPosition: Number,
    suggestion: mongoose.Schema.Types.Mixed,
  },
  { _id: false },
)

const ediDocumentSchema = new mongoose.Schema(
  {
    appName: { type: String, default: 'edith' },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    transactionType: { type: String, required: true },
    envelopeMetadata: { type: mongoose.Schema.Types.Mixed, required: true },
    rawContent: { type: String, required: true },
    parsed: { type: mongoose.Schema.Types.Mixed, required: true },
    hierarchy: { type: mongoose.Schema.Types.Mixed, required: true },
    errors: [issueSchema],
    warnings: [issueSchema],
    summaries: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
)

export const EdiDocument = mongoose.model('EdiDocument', ediDocumentSchema)
