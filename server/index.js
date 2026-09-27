const path = require('path')
const fs = require('fs')
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const DatabaseHelpers = require('./utils/dbHelpers')
const User = require('./models/User')

dotenv.config()

const app = express()

async function ensureAdminUser() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@placement.com').trim().toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123'
  const existingAdmin = await User.findOne({ email: adminEmail })

  if (existingAdmin) {
    if (existingAdmin.userType !== 'admin') {
      existingAdmin.userType = 'admin'
      existingAdmin.applicationStatus = 'accepted'
      existingAdmin.isVerified = true
      await existingAdmin.setPassword(adminPassword)
      await existingAdmin.save()
    }
    return
  }

  const admin = new User({
    email: adminEmail,
    userType: 'admin',
    isVerified: true,
    applicationStatus: 'accepted',
  })
  await admin.setPassword(adminPassword)
  await admin.save()
}

// Ensure uploads directories exist
const resumesDir = path.join(__dirname, 'uploads', 'resumes')
const profileAvatarsDir = path.join(__dirname, 'uploads', 'profile', 'avatars')
const profileResumesDir = path.join(__dirname, 'uploads', 'profile', 'resumes')
;[resumesDir, profileAvatarsDir, profileResumesDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
})

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}))
app.use(express.json())
// Serve uploaded files (resumes) at /api/uploads
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')))
app.use(cors({
  origin: ["http://localhost:3000"],
  credentials: true,
}));
// app.use(express.urlencoded({ extended: true }))


const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/placement'
mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log('Mongo connected')
    await ensureAdminUser()
    console.log('Admin user is ready')
  })
  .catch((e) => console.error('Mongo error', e))

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api', require('./routes'))

const port = process.env.PORT || 5000
app.listen(port, () => {
  console.log(`Server listening on ${port}`)

  // Run initial cleanup
  DatabaseHelpers.cleanupExpiredData().catch(console.error)

  // Set up periodic cleanup every hour (3600000 ms)
  setInterval(() => {
    DatabaseHelpers.cleanupExpiredData().catch(console.error)
  }, 3600000)
})


