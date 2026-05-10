'use client'

import { useEffect, useState } from 'react'
import { fetchCostBreakdown, type CostBreakdown } from '@/app/actions/costs'
import { format } from 'date-fns'

export function CostsTab() {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h')
  const [data, setData] = useState<CostBreakdown | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchCostBreakdown(timeRange)
      .then((result) => {
        if (active) {
          setData(result)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch costs', err)
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [timeRange])

  if (loading || !data) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Cost breakdown</div>
          </div>
        </div>
        <div className="panel-body text-gray-500">Loading cost data...</div>
      </div>
    )
  }

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`

  return (
    <div className="panel">
      <div className="panel-head flex items-center justify-between w-full">
        <div>
          <div className="panel-title">Cost breakdown</div>
        </div>
        <div className="flex gap-2">
          <button className={`btn sm ${timeRange === '24h' ? '' : 'ghost'}`} onClick={() => setTimeRange('24h')}>Last 24h</button>
          <button className={`btn sm ${timeRange === '7d' ? '' : 'ghost'}`} onClick={() => setTimeRange('7d')}>Last 7d</button>
          <button className={`btn sm ${timeRange === '30d' ? '' : 'ghost'}`} onClick={() => setTimeRange('30d')}>Last 30d</button>
        </div>
      </div>
      <div className="panel-body">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* OpenAI tokens cost */}
          <div className="p-4 border rounded-[12px] bg-slate-50 dark:bg-slate-900">
            <div className="text-sm font-semibold mb-1">OpenAI Tokens Cost</div>
            {data.hasOpenAiUsageField ? (
              <div className="text-2xl font-bold">{formatCurrency(data.openAiCost || 0)}</div>
            ) : (
              <div>
                <div className="text-2xl font-bold text-gray-400">{formatCurrency(data.openAiFallbackCost)} <span className="text-sm font-normal">(Est.)</span></div>
                <div className="text-xs text-orange-500 mt-1">Token tracking pending</div>
                {/* // Phase 13: full token cost tracking once openai_usage field instrumented */}
              </div>
            )}
          </div>

          {/* Vapi minutes cost */}
          <div className="p-4 border rounded-[12px] bg-slate-50 dark:bg-slate-900">
            <div className="text-sm font-semibold mb-1">Vapi Minutes Cost</div>
            <div className="text-2xl font-bold">{formatCurrency(data.vapiCost)}</div>
          </div>

          {/* Largest single run cost */}
          <div className="p-4 border rounded-[12px] bg-slate-50 dark:bg-slate-900">
            <div className="text-sm font-semibold mb-1">Largest Single Run</div>
            {data.largestRun ? (
              <div>
                <div className="text-2xl font-bold text-red-500">{formatCurrency(data.largestRun.cost)}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {data.largestRun.agentId} · {format(new Date(data.largestRun.timestamp), 'dd MMM HH:mm')}
                </div>
                <div className="text-xs text-gray-400 truncate">Run ID: {data.largestRun.runId}</div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm mt-2">No runs in window</div>
            )}
          </div>

          {/* Total per-agent table */}
          <div className="p-4 border rounded-[12px] bg-slate-50 dark:bg-slate-900 md:col-span-2">
            <div className="text-sm font-semibold mb-3">Cost by Agent</div>
            {data.agentBreakdown.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="pb-2 font-medium">Agent</th>
                      <th className="pb-2 font-medium text-right">Runs</th>
                      <th className="pb-2 font-medium text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.agentBreakdown.map((row) => (
                      <tr key={row.agentId} className="border-b last:border-0">
                        <td className="py-2 capitalize">{row.agentId.replace(/_/g, ' ')}</td>
                        <td className="py-2 text-right">{row.runCount}</td>
                        <td className="py-2 text-right font-medium">{formatCurrency(row.estCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No activity</div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
