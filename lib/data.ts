import trackingData from '@/data/tracking.json'

// Types
export interface Event {
  id: string
  date: string
  title: string
  description: string
  awsServicesAffected: string[]
  sources: Array<{
    url: string
    type: string
    createdAt: string
  }>
  createdAt: string
}

export interface Feature {
  id: string
  name: string
  description: string
}

export interface Service {
  id: string
  name: string
  company: string
  logoUrl: string
  url: string
  category: string
  features: Feature[]
  createdAt: string
}

export interface EventImpact {
  id: string
  eventId: string
  serviceId: string
  featureId: string
  impactType: 'full_outage' | 'degraded' | 'no_impact' | 'unknown'
  description: string
  verificationStatus: 'verified' | 'unverified' | 'user_reported'
  sourceUrl: string
  sourceType: string
  createdAt: string
}

export interface TrackingData {
  lastUpdated: string
  events: Event[]
  services: Service[]
  eventImpacts: EventImpact[]
}

// Get the data
export const data: TrackingData = trackingData as TrackingData

// Helper functions
export function getServiceById(serviceId: string): Service | undefined {
  return data.services.find(s => s.id === serviceId)
}

export function getEventById(eventId: string): Event | undefined {
  return data.events.find(e => e.id === eventId)
}

export function getFeatureById(serviceId: string, featureId: string): Feature | undefined {
  const service = getServiceById(serviceId)
  return service?.features.find(f => f.id === featureId)
}

export function getImpactsForService(serviceId: string): EventImpact[] {
  return data.eventImpacts.filter(i => i.serviceId === serviceId)
}

export function getImpactsForEvent(eventId: string): EventImpact[] {
  return data.eventImpacts.filter(i => i.eventId === eventId)
}

export function getImpactsForFeature(serviceId: string, featureId: string): EventImpact[] {
  return data.eventImpacts.filter(
    i => i.serviceId === serviceId && i.featureId === featureId
  )
}

// Get services with their impact data enriched
export interface EnrichedService extends Service {
  hasUsEast1Exposure: boolean
  impactedFeatures: number
  totalFeatures: number
  lastImpactDate: string | null
}

export function getEnrichedServices(): EnrichedService[] {
  return data.services.map(service => {
    const impacts = getImpactsForService(service.id)
    const impactedFeatureIds = new Set(
      impacts
        .filter(i => i.impactType === 'full_outage' || i.impactType === 'degraded')
        .map(i => i.featureId)
    )

    // Get the most recent impact date
    const impactDates = impacts.map(i => new Date(i.createdAt))
    const lastImpactDate = impactDates.length > 0
      ? new Date(Math.max(...impactDates.map(d => d.getTime()))).toISOString()
      : null

    return {
      ...service,
      hasUsEast1Exposure: impactedFeatureIds.size > 0,
      impactedFeatures: impactedFeatureIds.size,
      totalFeatures: service.features.length,
      lastImpactDate
    }
  })
}

// Get enriched impact data with joined service and event info
export interface EnrichedImpact extends EventImpact {
  service: Service | undefined
  event: Event | undefined
  feature: Feature | undefined
}

export function getEnrichedImpacts(): EnrichedImpact[] {
  return data.eventImpacts.map(impact => ({
    ...impact,
    service: getServiceById(impact.serviceId),
    event: getEventById(impact.eventId),
    feature: getFeatureById(impact.serviceId, impact.featureId)
  }))
}

// Search function
export function searchServices(query: string): EnrichedService[] {
  const lowerQuery = query.toLowerCase()
  const enriched = getEnrichedServices()

  if (!query.trim()) {
    return enriched
  }

  return enriched.filter(service =>
    service.name.toLowerCase().includes(lowerQuery) ||
    service.company.toLowerCase().includes(lowerQuery) ||
    service.category.toLowerCase().includes(lowerQuery) ||
    service.features.some(f =>
      f.name.toLowerCase().includes(lowerQuery) ||
      f.description.toLowerCase().includes(lowerQuery)
    )
  )
}
