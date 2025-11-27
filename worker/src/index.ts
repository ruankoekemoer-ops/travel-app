export interface Env {
  TRAVEL_DB: D1Database
  RESEND_API_KEY?: string
  QUOTES_BUCKET?: R2Bucket
}

type TravelRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

async function sendEmailNotification(
  apiKey: string,
  request: any,
  formData: any
): Promise<void> {
  const travelMode = formData.travelMode || 'FLIGHT'
  const isLocal = travelMode === 'LOCAL'

  // Build email content
  let emailBody = `
    <h2>New Travel Request Submitted</h2>
    <p><strong>Employee:</strong> ${request.employee_name}</p>
    <p><strong>Request ID:</strong> #${request.id}</p>
    <p><strong>Status:</strong> ${request.status}</p>
    <hr>
  `

  if (isLocal) {
    emailBody += `
      <h3>Local Travel Details</h3>
      <p><strong>Trip Type:</strong> ${request.trip_type}</p>
      <p><strong>Travel Date:</strong> ${request.start_date}${request.trip_type === 'RETURN' ? ` to ${request.end_date}` : ''}</p>
      ${request.pickup_time ? `<p><strong>Pickup Time:</strong> ${request.pickup_time}</p>` : ''}
      ${request.return_pickup_time ? `<p><strong>Return Pickup Time:</strong> ${request.return_pickup_time}</p>` : ''}
      ${request.pickup_location ? `<p><strong>Pickup Location:</strong> ${request.pickup_location}</p>` : ''}
      ${request.dropoff_location ? `<p><strong>Drop-off Location:</strong> ${request.dropoff_location}</p>` : ''}
      <p><strong>Number of Travellers:</strong> ${request.passenger_count || 1}</p>
    `
  } else {
    emailBody += `
      <h3>Flight Details</h3>
      <p><strong>Trip Type:</strong> ${request.trip_type}</p>
      <p><strong>Travel Dates:</strong> ${request.start_date}${request.trip_type !== 'ONE_WAY' ? ` to ${request.end_date}` : ''}</p>
      ${request.from_airport_code ? `<p><strong>From:</strong> ${request.from_airport_code} - ${request.from_airport_name || ''}</p>` : ''}
      ${request.to_airport_code ? `<p><strong>To:</strong> ${request.to_airport_code} - ${request.to_airport_name || ''}</p>` : ''}
      <p><strong>Number of Travellers:</strong> ${request.passenger_count || 1}</p>
    `
  }

  emailBody += `
    <h3>Services Required</h3>
    <ul>
      ${request.needs_flights ? '<li>✓ Flights</li>' : ''}
      ${request.needs_accommodation ? '<li>✓ Accommodation</li>' : ''}
      ${request.needs_transport ? '<li>✓ Transport to/from airport</li>' : ''}
      ${!request.needs_flights && !request.needs_accommodation && !request.needs_transport ? '<li>None selected</li>' : ''}
    </ul>
  `

  if (request.notes) {
    emailBody += `<p><strong>Notes:</strong> ${request.notes}</p>`
  }

  emailBody += `
    <hr>
    <p><em>Submitted at: ${request.created_at}</em></p>
  `

  // Send via Resend API
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Travel Request Portal <noreply@travel-requests.local>',
      to: ['ruankoekemoer@outlook.com'],
      subject: `New Travel Request: ${request.employee_name} - ${isLocal ? 'Local Travel' : `${request.from_airport_code || ''} → ${request.to_airport_code || ''}`}`,
      html: emailBody,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${response.status} - ${error}`)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url)
      const path = url.pathname

      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        })
      }

    if (path === '/api/requests' && request.method === 'GET') {
      const { results } = await env.TRAVEL_DB.prepare(
        'SELECT * FROM travel_requests ORDER BY created_at DESC'
      ).all()
      return json(results?.map(mapDbRowToApi) || [])
    }

    if (path === '/api/requests' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch (err) {
        return json({ error: 'Invalid JSON in request body' }, 400)
      }

      const {
        employeeName,
        startDate,
        endDate,
        fromAirportCode,
        fromAirportName,
        toAirportCode,
        toAirportName,
        tripType,
        pickupLocation,
        dropoffLocation,
        pickupTime,
        returnPickupTime,
        passengerCount,
        needsFlights,
        needsAccommodation,
        needsTransport,
        notes,
      } = body

      // Validate required fields
      if (!employeeName || !startDate) {
        return json({ error: 'Missing required fields: employeeName and startDate are required' }, 400)
      }

      try {
        const stmt = env.TRAVEL_DB.prepare(
          `INSERT INTO travel_requests
           (employee_name, destination, start_date, end_date,
            from_airport_code, from_airport_name,
            to_airport_code, to_airport_name,
            trip_type, pickup_location, dropoff_location,
            pickup_time, return_pickup_time,
            passenger_count,
            needs_flights, needs_accommodation, needs_transport,
            notes, quote_pdf_url, status)
           VALUES (?, ?, ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?, ?,
                   ?, ?,
                   ?,
                   ?, ?, ?,
                   ?, ?, 'WAITING_FOR_QUOTE')
           RETURNING *`
        ).bind(
          employeeName,
          '', // destination - deprecated, kept for backward compatibility
          startDate,
          endDate,
          fromAirportCode ?? null,
          fromAirportName ?? null,
          toAirportCode ?? null,
          toAirportName ?? null,
          tripType ?? 'ONE_WAY',
          pickupLocation ?? null,
          dropoffLocation ?? null,
          pickupTime ?? null,
          returnPickupTime ?? null,
          passengerCount ?? 1,
          needsFlights ? 1 : 0,
          needsAccommodation ? 1 : 0,
          needsTransport ? 1 : 0,
          notes ?? null,
          null // quote_pdf_url initially null
        )

        const { results } = await stmt.all()
        const dbRow = results?.[0]
        const created = dbRow ? mapDbRowToApi(dbRow) : null

        if (!created) {
          return json({ error: 'Failed to create travel request' }, 500)
        }

        // Send notifications (non-blocking - don't fail request if notifications fail)
        if (dbRow && env.RESEND_API_KEY) {
          sendEmailNotification(env.RESEND_API_KEY, dbRow, body).catch((err) => {
            console.error('Failed to send email notification:', err)
          })
        }

        return json(created, 201)
      } catch (err: any) {
        console.error('Database error:', err)
        return json({ error: `Database error: ${err.message || 'Unknown error'}` }, 500)
      }
    }

    const quoteMatch = path.match(/^\/api\/requests\/(\d+)\/quote$/)
    if (quoteMatch && request.method === 'POST') {
      const id = Number(quoteMatch[1])
      const formData = await request.formData()
      const file = formData.get('quote') as File

      if (!file || file.type !== 'application/pdf') {
        return json({ error: 'Invalid file. Please upload a PDF file.' }, 400)
      }

      // Check file size (18MB limit for base64 fallback, 100MB for R2)
      const maxSizeBase64 = 18 * 1024 * 1024 // 18MB
      const maxSizeR2 = 100 * 1024 * 1024 // 100MB
      
      if (file.size > maxSizeR2) {
        return json({ error: 'File too large. Maximum size is 100MB.' }, 400)
      }

      let quoteUrl: string

      // Use R2 if available, otherwise fallback to base64 in D1
      if (env.QUOTES_BUCKET) {
        // Store in R2
        const fileName = `quote-${id}-${Date.now()}.pdf`
        await env.QUOTES_BUCKET.put(fileName, file, {
          httpMetadata: {
            contentType: 'application/pdf',
          },
        })
        // Generate absolute URL for the file
        const baseUrl = new URL(request.url).origin
        quoteUrl = `${baseUrl}/api/quotes/${fileName}`
      } else {
        // Fallback: Store as base64 in D1 (limited to ~18MB)
        if (file.size > maxSizeBase64) {
          return json({ 
            error: 'File too large for current storage. Please enable R2 storage in Cloudflare Dashboard for files larger than 18MB.' 
          }, 400)
        }
        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        quoteUrl = `data:application/pdf;base64,${base64}`
      }

      const { results } = await env.TRAVEL_DB.prepare(
        `UPDATE travel_requests
         SET quote_pdf_url = ?
         WHERE id = ?
         RETURNING *`
      )
        .bind(quoteUrl, id)
        .all()

      const updated = results?.[0] ? mapDbRowToApi(results[0]) : null
      if (!updated) return json({ error: 'Not found' }, 404)
      return json(updated)
    }

    const statusMatch = path.match(/^\/api\/requests\/(\d+)\/status$/)
    if (statusMatch && request.method === 'PATCH') {
      const id = Number(statusMatch[1])
      const body = (await request.json()) as { status: TravelRequestStatus }

      const { results } = await env.TRAVEL_DB.prepare(
        `UPDATE travel_requests
         SET status = ?
         WHERE id = ?
         RETURNING *`
      )
        .bind(body.status, id)
        .all()

      const updated = results?.[0] ? mapDbRowToApi(results[0]) : null
      if (!updated) return json({ error: 'Not found' }, 404)
      return json(updated)
    }

    // Serve PDF files from R2
    const quoteFileMatch = path.match(/^\/api\/quotes\/(.+)$/)
    if (quoteFileMatch && request.method === 'GET') {
      if (!env.QUOTES_BUCKET) {
        return new Response('R2 storage not configured', { status: 503 })
      }
      const fileName = quoteFileMatch[1]
      const object = await env.QUOTES_BUCKET.get(fileName)
      if (!object) {
        return new Response('File not found', { status: 404 })
      }
      return new Response(object.body, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    if (path === '/api/health') {
      return json({ ok: true })
    }

    // Root path - provide helpful info
    if (path === '/') {
      return json({
        service: 'Travel Requests API',
        version: '1.0.0',
        endpoints: [
          'GET /api/requests - List all travel requests',
          'POST /api/requests - Create a new travel request',
          'POST /api/requests/:id/quote - Upload quote PDF',
          'PATCH /api/requests/:id/status - Update request status',
          'GET /api/health - Health check',
        ],
      })
    }

      return new Response('Not found', { status: 404 })
    } catch (err: any) {
      console.error('Unhandled error:', err)
      return json({ error: `Internal server error: ${err.message || 'Unknown error'}` }, 500)
    }
  },
} satisfies ExportedHandler<Env>

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function mapDbRowToApi(row: any): any {
  const mapped: any = {}
  for (const key in row) {
    mapped[toCamelCase(key)] = row[key]
  }
  return mapped
}




