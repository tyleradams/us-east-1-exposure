'use client'

import { useState } from 'react'
import {
  searchServices,
  getImpactsForService,
  getEventById,
  getFeatureById,
  type EnrichedService,
  type EventImpact
} from '@/lib/data'

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const results = searchServices(searchQuery)

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            US-EAST-1 Exposure Tracker
          </h1>
          <p className="text-lg text-gray-600">
            Track which services still have exposure to AWS US-EAST-1 region outages
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search services, companies, or features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-gray-600">
          {results.length} service{results.length !== 1 ? 's' : ''} found
          {results.filter(s => s.hasUsEast1Exposure).length > 0 && (
            <span className="ml-2">
              ({results.filter(s => s.hasUsEast1Exposure).length} with confirmed US-EAST-1 exposure)
            </span>
          )}
        </div>

        {/* Services list */}
        <div className="space-y-6">
          {results.map(service => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>

        {results.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No services found matching your search.
          </div>
        )}
      </div>
    </main>
  )
}

function ServiceCard({ service }: { service: EnrichedService }) {
  const [expanded, setExpanded] = useState(false)
  const impacts = getImpactsForService(service.id)

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div
        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            {/* Logo */}
            <img
              src={service.logoUrl}
              alt={`${service.name} logo`}
              className="w-12 h-12 rounded"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(service.name)}&background=random`
              }}
            />

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {service.name}
                </h2>
                <span className="text-sm text-gray-500">{service.company}</span>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                  {service.category}
                </span>

                {service.hasUsEast1Exposure && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
                    US-EAST-1 Exposure
                  </span>
                )}

                <span className="text-gray-600">
                  {service.impactedFeatures} of {service.totalFeatures} features affected
                </span>
              </div>
            </div>
          </div>

          {/* Expand indicator */}
          <div className="ml-4 text-gray-400">
            {expanded ? '▼' : '▶'}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Feature Impact History</h3>

          {service.features.map(feature => {
            const featureImpacts = impacts.filter(i => i.featureId === feature.id)

            return (
              <div key={feature.id} className="mb-6 last:mb-0">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="mb-3">
                    <h4 className="font-medium text-gray-900 mb-1">{feature.name}</h4>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>

                  {featureImpacts.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No impact data recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {featureImpacts.map(impact => (
                        <ImpactEntry key={impact.id} impact={impact} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ImpactEntry({ impact }: { impact: EventImpact }) {
  const event = getEventById(impact.eventId)

  const impactColors = {
    full_outage: 'bg-red-50 border-red-200',
    degraded: 'bg-yellow-50 border-yellow-200',
    no_impact: 'bg-green-50 border-green-200',
    unknown: 'bg-gray-50 border-gray-200'
  }

  const impactTextColors = {
    full_outage: 'text-red-800',
    degraded: 'text-yellow-800',
    no_impact: 'text-green-800',
    unknown: 'text-gray-800'
  }

  const impactLabels = {
    full_outage: 'Full Outage',
    degraded: 'Degraded',
    no_impact: 'No Impact',
    unknown: 'Unknown'
  }

  return (
    <div className={`border rounded p-3 ${impactColors[impact.impactType]}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm ${impactTextColors[impact.impactType]}`}>
            {impactLabels[impact.impactType]}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(impact.createdAt).toLocaleDateString()}
          </span>
        </div>

        <span className="text-xs px-2 py-1 bg-white rounded">
          {impact.verificationStatus}
        </span>
      </div>

      {event && (
        <div className="text-sm font-medium text-gray-700 mb-1">
          Event: {event.title} ({new Date(event.date).toLocaleDateString()})
        </div>
      )}

      <p className="text-sm text-gray-700 mb-2">{impact.description}</p>

      <a
        href={impact.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline"
      >
        Source: {impact.sourceType}
      </a>
    </div>
  )
}
