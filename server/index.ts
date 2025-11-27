import express from 'express'
import cors from 'cors'
import multer from 'multer'

type TravelRequestStatus = 'WAITING_FOR_QUOTE' | 'PENDING' | 'APPROVED' | 'REJECTED'

type TravelRequest = {
  id: number
  employeeName: string
  startDate: string
  endDate: string
  fromAirportCode?: string
  fromAirportName?: string
  toAirportCode?: string
  toAirportName?: string
  tripType: string
  pickupLocation?: string
  dropoffLocation?: string
  passengerCount: number
  needsFlights: number
  needsAccommodation: number
  needsTransport: number
  notes?: string
  quotePdfUrl?: string
  status: TravelRequestStatus
}

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage() })

let requests: TravelRequest[] = []
let nextId = 1

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/requests', (_req, res) => {
  res.json(requests)
})

app.post('/api/requests', (req, res) => {
  const body = req.body as Omit<
    TravelRequest,
    | 'id'
    | 'status'
    | 'needsFlights'
    | 'needsAccommodation'
    | 'needsTransport'
  > & {
    needsFlights: boolean
    needsAccommodation: boolean
    needsTransport: boolean
  }

  const newRequest: TravelRequest = {
    id: nextId++,
    employeeName: body.employeeName,
    startDate: body.startDate,
    endDate: body.endDate || body.startDate,
    fromAirportCode: body.fromAirportCode,
    fromAirportName: body.fromAirportName,
    toAirportCode: body.toAirportCode,
    toAirportName: body.toAirportName,
    tripType: body.tripType ?? 'ONE_WAY',
    pickupLocation: body.pickupLocation,
    dropoffLocation: body.dropoffLocation,
    passengerCount: body.passengerCount ?? 1,
    needsFlights: body.needsFlights ? 1 : 0,
    needsAccommodation: body.needsAccommodation ? 1 : 0,
    needsTransport: body.needsTransport ? 1 : 0,
    notes: body.notes,
    quotePdfUrl: undefined,
    status: 'WAITING_FOR_QUOTE',
  }

  // TODO: replace with Cloudflare D1 insert
  requests.push(newRequest)
  res.status(201).json(newRequest)
})

app.post('/api/requests/:id/quote', upload.single('quote'), (req, res) => {
  const id = Number(req.params.id)
  const file = req.file

  if (!file || file.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'Invalid file. Please upload a PDF file.' })
  }

  const idx = requests.findIndex((r) => r.id === id)
  if (idx === -1) {
    return res.status(404).json({ error: 'Not found' })
  }

  // Convert to base64 data URL
  const base64 = file.buffer.toString('base64')
  const dataUrl = `data:application/pdf;base64,${base64}`

  requests[idx] = { ...requests[idx], quotePdfUrl: dataUrl }
  // TODO: replace with Cloudflare D1 update

  res.json(requests[idx])
})

app.patch('/api/requests/:id/status', (req, res) => {
  const id = Number(req.params.id)
  const { status } = req.body as { status: TravelRequestStatus }

  const idx = requests.findIndex((r) => r.id === id)
  if (idx === -1) {
    return res.status(404).json({ error: 'Not found' })
  }

  requests[idx] = { ...requests[idx], status }
  // TODO: replace with Cloudflare D1 update

  res.json(requests[idx])
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})


