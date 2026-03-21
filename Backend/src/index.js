import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { env } from './config/env.js'
import ediRoutes from './routes/ediRoutes.js'

const app = express()

app.use(
  cors({
    origin: env.frontendUrl === '*' ? true : env.frontendUrl,
  }),
)
app.use(express.json({ limit: '4mb' }))

app.use('/api', ediRoutes)

const start = async () => {
  try {
    if (!env.mongoUri) {
      throw new Error('Missing MONGO_URI environment variable')
    }
    await mongoose.connect(env.mongoUri)

    app.listen(env.port, () => {
      console.log(`edith-backend listening on ${env.port}`)
    })
  } catch (err) {
    console.error('edith-backend failed to start', err)
    process.exit(1)
  }
}

start()
