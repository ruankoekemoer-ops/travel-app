import React, { useEffect, useState } from 'react'
import './App.css'

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
  tripType: 'ONE_WAY' | 'RETURN' | 'MULTI_LEG'
  pickupLocation?: string
  dropoffLocation?: string
  pickupTime?: string
  returnPickupTime?: string
  passengerCount: number
  needsFlights: boolean
  needsAccommodation: boolean
  needsTransport: boolean
  notes?: string
  quotePdfUrl?: string
  status: TravelRequestStatus
}

type TravelRequestFormState = Omit<TravelRequest, 'id' | 'status'> & {
  travelMode: 'FLIGHT' | 'LOCAL'
}

const ClipboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="6" y="3" width="12" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <rect x="9" y="1.5" width="6" height="3" rx="1.5" fill="currentColor" />
  </svg>
)

const InboxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M4 5h16l-2 9h-4l-2 3-2-3H6L4 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 12.5l2.5 2L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TicketIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M3 8h5a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2v0a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h5v-4a2 2 0 0 1 0-4V8H3Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
)

const emptyForm: TravelRequestFormState = {
  employeeName: '',
  startDate: '',
  endDate: '',
  fromAirportCode: '',
  fromAirportName: '',
  toAirportCode: '',
  toAirportName: '',
  tripType: 'ONE_WAY',
  travelMode: 'FLIGHT',
  pickupLocation: '',
  dropoffLocation: '',
  pickupTime: '',
  returnPickupTime: '',
  passengerCount: 1,
  needsFlights: false,
  needsAccommodation: false,
  needsTransport: false,
  notes: '',
}

const API_BASE =
  import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL !== ''
    ? import.meta.env.VITE_API_BASE_URL
    : import.meta.env.MODE === 'development'
    ? 'http://localhost:4000'
    : 'https://travel-requests-api.rkoekemoer.workers.dev'

type AirportOption = {
  code: string
  name: string
  city: string
  country: string
}

type AirportPickerProps = {
  label: string
  valueCode?: string
  valueName?: string
  onSelect: (airport: AirportOption) => void
  airports: AirportOption[]
}

function AirportPicker({
  label,
  valueCode,
  valueName,
  onSelect,
  airports,
}: AirportPickerProps) {
  const [query, setQuery] = useState('')

  const selectedLabel =
    valueCode && valueName ? `${valueCode} • ${valueName}` : 'Select airport'

  const filtered = query
    ? airports
        .filter((a) => {
          const q = query.toLowerCase()
          return (
            a.code.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.city.toLowerCase().includes(q)
          )
        })
        .slice(0, 10)
    : airports.slice(0, 10)

  return (
    <div className="field">
      <label>{label}</label>
      <div className="airport-picker">
        <input
          className="airport-input"
          placeholder={selectedLabel}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <div className="airport-dropdown">
            {filtered.length === 0 && (
              <div className="airport-empty">No airports match your search</div>
            )}
            {filtered.map((a) => (
              <button
                key={`${a.code}-${a.name}`}
                type="button"
                className="airport-option"
                onClick={() => {
                  onSelect(a)
                  setQuery('')
                }}
              >
                <span className="airport-code">{a.code}</span>
                <span className="airport-main">{a.name}</span>
                <span className="airport-meta">
                  {a.city && `${a.city}, `} {a.country}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  const [tab, setTab] = useState<'request' | 'quotes' | 'approve' | 'tickets'>('request')
  const [form, setForm] = useState<TravelRequestFormState>(emptyForm)
  const [requests, setRequests] = useState<TravelRequest[]>([])
  const [airports, setAirports] = useState<AirportOption[]>([])
  const [uploadingQuote, setUploadingQuote] = useState<{ [key: number]: boolean }>({})
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [userName, setUserName] = useState('')
  const [showLogin, setShowLogin] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const navItems: { id: typeof tab; label: string; icon: React.ReactElement }[] = [
    { id: 'request', label: 'New request', icon: <ClipboardIcon /> },
    { id: 'quotes', label: 'Waiting', icon: <InboxIcon /> },
    { id: 'approve', label: 'Approvals', icon: <CheckIcon /> },
    { id: 'tickets', label: 'Tickets', icon: <TicketIcon /> },
  ]

  const renderDateField = (
    field: 'startDate' | 'endDate',
    labelText: string,
    required = false
  ) => (
    <label className="date-field" key={field}>
      <div className="date-visual">
        <span className="date-label">{labelText}</span>
        <span className="date-value">
          {form[field]
            ? new Date(form[field]).toLocaleDateString(undefined, {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              })
            : 'Select date'}
        </span>
      </div>
      <input
        type="date"
        name={field}
        value={form[field]}
        onChange={handleChange}
        required={required}
      />
    </label>
  )

  useEffect(() => {
    fetch(`${API_BASE}/api/requests`)
      .then((res) => res.json())
      .then((data: any[]) => {
        const normalized: TravelRequest[] = data.map((r) => ({
          ...r,
          needsFlights: Boolean(r.needsFlights),
          needsAccommodation: Boolean(r.needsAccommodation),
          needsTransport: Boolean(r.needsTransport),
          tripType: (r.tripType as TravelRequest['tripType']) ?? 'ONE_WAY',
        }))
        setRequests(normalized)
      })
      .catch((err) => {
        console.error('Failed to load requests', err)
      })
  }, [])

  useEffect(() => {
    if (userName) {
      setForm((prev) => ({ ...prev, employeeName: userName }))
    }
  }, [userName])

  useEffect(() => {
    // Load full airport list (IATA codes) once for search
    fetch(
      'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json'
    )
      .then((res) => res.json())
      .then((data) => {
        const list: AirportOption[] = []
        for (const key of Object.keys(data)) {
          const a = data[key]
          if (!a.iata || !a.name) continue
          list.push({
            code: a.iata,
            name: a.name,
            city: a.city ?? '',
            country: a.country ?? '',
          })
        }
        list.sort((a, b) => a.code.localeCompare(b.code))
        setAirports(list)
      })
      .catch((err) => {
        console.error('Failed to load airports', err)
      })
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement
    const { name, value, type } = target
    const checked = (target as HTMLInputElement).checked
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const payload: TravelRequestFormState = {
      ...form,
      endDate:
        form.tripType === 'ONE_WAY' || !form.endDate
          ? form.startDate
          : form.endDate,
    }

    fetch(`${API_BASE}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`HTTP ${res.status}: ${errorText}`)
        }
        return res.json()
      })
      .then((created: TravelRequest) => {
        setRequests((prev) => [
          ...prev,
          {
            ...created,
            needsFlights: Boolean(created.needsFlights),
            needsAccommodation: Boolean(created.needsAccommodation),
            needsTransport: Boolean(created.needsTransport),
          },
        ])
        setForm(emptyForm)
        setShowSuccessMessage(true)
        setTab('quotes')
        
        // Auto-hide message after 5 seconds
        setTimeout(() => {
          setShowSuccessMessage(false)
        }, 5000)
      })
      .catch((err) => {
        console.error('Failed to create request', err)
        alert(`Failed to submit travel request: ${err.message}. Please try again.`)
      })
  }

  const updateStatus = (id: number, status: TravelRequestStatus) => {
    fetch(`${API_BASE}/api/requests/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
      .then((res) => res.json())
      .then((updated: TravelRequest) => {
        setRequests((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        )
      })
      .catch((err) => {
        console.error('Failed to update status', err)
      })
  }

  const uploadQuote = (id: number, file: File) => {
    setUploadingQuote((prev) => ({ ...prev, [id]: true }))
    const formData = new FormData()
    formData.append('quote', file)

    fetch(`${API_BASE}/api/requests/${id}/quote`, {
      method: 'POST',
      body: formData,
    })
      .then((res) => res.json())
      .then((updated: TravelRequest) => {
        setRequests((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        )
        setUploadingQuote((prev) => ({ ...prev, [id]: false }))
      })
      .catch((err) => {
        console.error('Failed to upload quote', err)
        setUploadingQuote((prev) => ({ ...prev, [id]: false }))
      })
  }

  const submitForApproval = (id: number) => {
    updateStatus(id, 'PENDING')
  }

  const waitingForQuoteRequests = requests.filter((r) => r.status === 'WAITING_FOR_QUOTE')
  const pendingRequests = requests.filter((r) => r.status === 'PENDING')
  const approvedRequests = requests.filter((r) => r.status === 'APPROVED')

  return (
    <div className="fo-shell">
      <header className="fo-topbar">
        <div className="fo-topbar-left">
          <span className="fo-hamburger">☰</span>
          <span className="fo-app-name">Finance and Operations</span>
        </div>
        <div className="fo-topbar-right">
          <span className="fo-topbar-env">Travel workspace</span>
          <span className="fo-topbar-icon">?</span>
          <span className="fo-topbar-icon">🔔</span>
          <span className="fo-topbar-icon">⚙️</span>
          <span className="fo-topbar-user">RK</span>
        </div>
      </header>
      <div className={sidebarCollapsed ? 'layout collapsed' : 'layout'}>
      {(showSuccessMessage || showLogin) && (
        <div className="modal-overlay" onClick={() => setShowSuccessMessage(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {showLogin ? (
              <>
                <div className="modal-header">
                  <h2>Welcome</h2>
                </div>
                <div className="modal-body">
                  <p>Please sign in to continue.</p>
                  <form
                    className="login-form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const data = new FormData(e.currentTarget)
                      const first = (data.get('firstName') as string) || ''
                      const last = (data.get('lastName') as string) || ''
                      const name = `${first.trim()} ${last.trim()}`.trim()
                      if (name) {
                        setUserName(name)
                        setShowLogin(false)
                      }
                    }}
                  >
                    <input name="firstName" placeholder="First name" required />
                    <input name="lastName" placeholder="Last name" required />
                    <button type="submit" className="primary">
                      Continue
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <div className="modal-header">
                  <h2>✓ Request Submitted Successfully</h2>
                </div>
                <div className="modal-body">
                  <p>Your travel request has been submitted and is now waiting for acceptance.</p>
                  <p className="muted small">You can view it in the "Waiting for Acceptance" section.</p>
                </div>
                <div className="modal-footer">
                  <button className="primary" onClick={() => setShowSuccessMessage(false)}>
                    OK
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <aside className={sidebarCollapsed ? 'sidebar collapsed' : 'sidebar'}>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((prev) => !prev)}
          aria-label="Toggle navigation"
        >
          ≡
        </button>
        <nav className={sidebarCollapsed ? 'icon-nav collapsed' : 'icon-nav'}>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? 'icon-link active' : 'icon-link'}
              onClick={() => setTab(item.id)}
              aria-label={item.label}
            >
              <span className="icon-emoji">{item.icon}</span>
              <span className="icon-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="app-shell">
        <header className="app-header">
          <div>
            <h1>Travel Request Portal</h1>
            <p>Submit and manage business travel in one place.</p>
          </div>
          <div className="header-right">
            <button className="header-icon-button" aria-label="Settings">
              ⚙️
            </button>
            <div className="user-pill">
              <span className="avatar-dot" />
              <span>{userName || 'Travel Coordinator'}</span>
            </div>
          </div>
        </header>

        <main className="app-main">
          <section className="hero">
            <div className="hero-overlay" />
          </section>

          <section className="section-header">
            <div>
              <h2 className="section-title">Travel Requests</h2>
              <p className="section-subtitle">
                Manage company travel requests, approvals, and ticketing.
              </p>
            </div>
            <span className="pill-label">Beta</span>
          </section>

        <div className="card-grid">
          {tab === 'request' && (
            <section className="card stretch-card">
              <h3 className="card-title">New request</h3>
              <form className="form-stack" onSubmit={handleSubmit}>
                <div className="segment">
                  <label>Travel mode</label>
                  <div className="trip-type-row">
                    <label className="radio-pill">
                      <input
                        type="radio"
                        name="travelMode"
                        value="FLIGHT"
                        checked={form.travelMode === 'FLIGHT'}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            travelMode: 'FLIGHT',
                            needsFlights: true,
                          }))
                        }
                      />
                      Flights
                    </label>
                    <label className="radio-pill">
                      <input
                        type="radio"
                        name="travelMode"
                        value="LOCAL"
                        checked={form.travelMode === 'LOCAL'}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            travelMode: 'LOCAL',
                            tripType: 'ONE_WAY',
                            needsFlights: false,
                          }))
                        }
                      />
                      Road
                    </label>
                  </div>
                </div>

                <div className="segment">
                  <label htmlFor="employeeName">Employee name</label>
                  <input
                    id="employeeName"
                    name="employeeName"
                    value={form.employeeName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="segment">
                  <label>{form.travelMode === 'FLIGHT' ? 'Trip type' : 'Trip direction'}</label>
                  <div className="trip-type-row">
                    <label className="radio-pill">
                      <input
                        type="radio"
                        name="tripType"
                        value="ONE_WAY"
                        checked={form.tripType === 'ONE_WAY'}
                        onChange={() =>
                          setForm((prev) => ({ ...prev, tripType: 'ONE_WAY' }))
                        }
                      />
                      One-way
                    </label>
                    <label className="radio-pill">
                      <input
                        type="radio"
                        name="tripType"
                        value="RETURN"
                        checked={form.tripType === 'RETURN'}
                        onChange={() =>
                          setForm((prev) => ({ ...prev, tripType: 'RETURN' }))
                        }
                      />
                      Return
                    </label>
                    {form.travelMode === 'FLIGHT' && (
                      <label className="radio-pill">
                        <input
                          type="radio"
                          name="tripType"
                          value="MULTI_LEG"
                          checked={form.tripType === 'MULTI_LEG'}
                          onChange={() =>
                            setForm((prev) => ({ ...prev, tripType: 'MULTI_LEG' }))
                          }
                        />
                        Multi-leg
                      </label>
                    )}
                  </div>
                  <div className="dates-grid">
                    {renderDateField('startDate', 'Depart', true)}
                    {form.tripType !== 'ONE_WAY' &&
                      renderDateField('endDate', 'Return', true)}
                  </div>
                </div>

                {form.travelMode === 'LOCAL' && (
                  <>
                    <div className="segment">
                      <label>
                        {form.tripType === 'ONE_WAY'
                          ? 'Pickup time'
                          : 'Departure pickup time'}
                      </label>
                      <input
                        type="time"
                        name="pickupTime"
                        value={form.pickupTime || ''}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    {form.tripType === 'RETURN' && (
                      <div className="segment">
                        <label>Return pickup time</label>
                        <input
                          type="time"
                          name="returnPickupTime"
                          value={form.returnPickupTime || ''}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    )}
                  </>
                )}

                {form.travelMode === 'FLIGHT' && (
                  <div className="segment">
                    <label>Route</label>
                    <div className="route-column">
                      <AirportPicker
                        label="From"
                        valueCode={form.fromAirportCode}
                        valueName={form.fromAirportName}
                        airports={airports}
                        onSelect={(airport) =>
                          setForm((prev) => ({
                            ...prev,
                            fromAirportCode: airport.code,
                            fromAirportName: airport.name,
                          }))
                        }
                      />
                      <AirportPicker
                        label="To"
                        valueCode={form.toAirportCode}
                        valueName={form.toAirportName}
                        airports={airports}
                        onSelect={(airport) =>
                          setForm((prev) => ({
                            ...prev,
                            toAirportCode: airport.code,
                            toAirportName: airport.name,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="segment">
                  <label>Services required</label>
                  <div className="options-row">
                    {form.travelMode === 'FLIGHT' && (
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          name="needsFlights"
                          checked={form.needsFlights}
                          onChange={handleChange}
                        />
                        Flights
                      </label>
                    )}
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        name="needsAccommodation"
                        checked={form.needsAccommodation}
                        onChange={handleChange}
                      />
                      Accommodation
                    </label>
                    {form.travelMode === 'FLIGHT' && (
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          name="needsTransport"
                          checked={form.needsTransport}
                          onChange={handleChange}
                        />
                        Transport to/from airport
                      </label>
                    )}
                  </div>
                </div>

                {(form.travelMode === 'LOCAL' || form.needsTransport) && (
                  <div className="segment">
                  <label>
                    {form.travelMode === 'LOCAL'
                      ? 'Route (start and destination)'
                      : 'Airport transport details'}
                  </label>
                    <div className="route-column">
                      <input
                        name="pickupLocation"
                        placeholder="Pickup address / location"
                        value={form.pickupLocation}
                        onChange={handleChange}
                        required={form.travelMode === 'LOCAL'}
                      />
                      <input
                        name="dropoffLocation"
                        placeholder="Drop-off address / location"
                        value={form.dropoffLocation}
                        onChange={handleChange}
                        required={form.travelMode === 'LOCAL'}
                      />
                    </div>
                    <p className="muted small">
                      Start typing and your browser will suggest recent places; we
                      can later plug this into autocomplete.
                    </p>
                  </div>
                )}

                <div className="segment">
                  <label htmlFor="passengerCount">Number of travellers</label>
                  <input
                    id="passengerCount"
                    name="passengerCount"
                    type="number"
                    min={1}
                    value={form.passengerCount}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        passengerCount: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    required
                  />
                </div>

                <div className="segment">
                  <label htmlFor="notes">Notes / purpose of travel</label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="E.g. client meeting, training, site visit..."
                  />
                </div>

                <div className="actions">
                  <button type="submit" className="primary">
                    Submit
                  </button>
                </div>
              </form>
            </section>
          )}

        {tab === 'quotes' && (
          <section className="card">
            <h3 className="card-title">Waiting for Acceptance</h3>
            {waitingForQuoteRequests.length === 0 ? (
              <p className="muted">No requests waiting for quotes.</p>
            ) : (
              <ul className="request-list">
                {waitingForQuoteRequests.map((r) => (
                  <li key={r.id} className="request-row">
      <div>
                      <h3>
                        {r.employeeName} - {r.fromAirportCode && r.toAirportCode ? `${r.fromAirportCode} → ${r.toAirportCode}` : 'Local Travel'}
                      </h3>
                      <p className="muted">
                        {r.startDate} {r.tripType !== 'ONE_WAY' ? `→ ${r.endDate}` : ''}
                      </p>
                      <p className="muted small">
                        {[
                          r.needsFlights && 'Flights',
                          r.needsAccommodation && 'Accommodation',
                          r.needsTransport && 'Airport transport',
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'No services selected'}
                      </p>
                      {r.notes && <p className="notes">{r.notes}</p>}
                      {r.quotePdfUrl && (
                        <p className="muted small">
                          <a href={r.quotePdfUrl} target="_blank" rel="noopener noreferrer">
                            📄 View Quote PDF
                          </a>
                        </p>
                      )}
                    </div>
                    <div className="row-actions">
                      <div className="field">
                        <label htmlFor={`quote-${r.id}`}>Attach Quote PDF</label>
                        <input
                          id={`quote-${r.id}`}
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              uploadQuote(r.id, file)
                            }
                          }}
                          disabled={uploadingQuote[r.id]}
                        />
                      </div>
                      {r.quotePdfUrl && (
                        <button
                          className="primary"
                          onClick={() => submitForApproval(r.id)}
                        >
                          Submit for Approval
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'approve' && (
          <section className="card">
            <h3 className="card-title">Pending approvals</h3>
            {pendingRequests.length === 0 ? (
              <p className="muted">No pending requests.</p>
            ) : (
              <ul className="request-list">
                {pendingRequests.map((r) => (
                  <li key={r.id} className="request-row">
                    <div>
                      <h3>
                        {r.employeeName} - {r.fromAirportCode} → {r.toAirportCode}
                      </h3>
                      <p className="muted">
                        {r.startDate} → {r.endDate}
                      </p>
                      <p className="muted small">
                        {[
                          r.needsFlights && 'Flights',
                          r.needsAccommodation && 'Accommodation',
                          r.needsTransport && 'Airport transport',
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'No services selected'}
                      </p>
                      {r.notes && <p className="notes">{r.notes}</p>}
                      {r.quotePdfUrl && (
                        <p className="muted small">
                          <a
                            href={r.quotePdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            📄 View Quote PDF
                          </a>
                        </p>
                      )}
      </div>
                    <div className="row-actions">
                      <button
                        className="secondary"
                        onClick={() => updateStatus(r.id, 'REJECTED')}
                      >
                        Reject
                      </button>
                      <button
                        className="primary"
                        onClick={() => updateStatus(r.id, 'APPROVED')}
                      >
                        Approve
        </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'tickets' && (
          <section className="card">
            <h3 className="card-title">Manage tickets</h3>
            {approvedRequests.length === 0 ? (
              <p className="muted">No approved requests yet.</p>
            ) : (
              <ul className="request-list">
                {approvedRequests.map((r) => (
                  <li key={r.id} className="request-row">
                    <div>
                      <h3>
                        {r.employeeName} - {r.fromAirportCode} → {r.toAirportCode}
                      </h3>
                      <p className="muted">
                        {r.startDate} → {r.endDate}
                      </p>
                      <p className="muted small">
                        {[
                          r.needsFlights && 'Flights',
                          r.needsAccommodation && 'Accommodation',
                          r.needsTransport && 'Airport transport',
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'No services selected'}
                      </p>
                    </div>
                    <div className="row-actions">
                      <button className="secondary">Mark as ticketed</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        </div>
        </main>
      </div>
    </div>
    </div>
  )
}

export default App

