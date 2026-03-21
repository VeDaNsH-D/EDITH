import express from 'express'
import multer from 'multer'
import { askEdiAssistant } from '../services/aiService.js'
import { processEdiFile, revalidateWithFix } from '../services/ediService.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.get('/health', (req, res) => {
  res.json({ ok: true, app: 'edith-backend' })
})

router.post('/edi/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const result = await processEdiFile({
      fileName: req.file.originalname,
      rawContent: req.file.buffer.toString('utf-8'),
    })

    return res.json(result)
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Upload failed' })
  }
})

router.post('/edi/apply-fix', async (req, res) => {
  try {
    const { documentId, suggestion } = req.body
    const result = await revalidateWithFix({ documentId, suggestion })
    return res.json(result)
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Failed to apply fix' })
  }
})

router.post('/edi/chat', async (req, res) => {
  try {
    const { question, context } = req.body
    if (!question) return res.status(400).json({ message: 'Question is required' })

    const result = await askEdiAssistant({ question, context })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Chat failed' })
  }
})

export default router
