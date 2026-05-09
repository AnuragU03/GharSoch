import type { AgentRunContext } from '@/lib/runAgent'

export async function calculateAffordabilityTool(args: Record<string, any>, ctx: AgentRunContext) {
  const monthlyIncome = Number(args.monthly_income || 0)
  const existingEmis = Number(args.existing_emis || 0)
  const monthlyExpenses = Number(args.monthly_expenses || 0)
  const propertyPrice = Number(args.property_price || 0)
  const downPayment = Number(args.down_payment || 0)

  const principal = Math.max(0, propertyPrice - downPayment)
  const monthlyRate = 0.08 / 12
  const tenureMonths = 20 * 12
  const emi = principal > 0
    ? (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1)
    : 0
  const surplus = monthlyIncome - existingEmis - monthlyExpenses

  let signal = 'no-go'
  if (surplus >= emi * 1.5) signal = 'go'
  else if (surplus >= emi) signal = 'reconsider'

  const message =
    signal === 'go'
      ? `This looks comfortable. Estimated EMI is Rs ${Math.round(emi).toLocaleString('en-IN')} per month, and the customer keeps a surplus of about Rs ${Math.round(surplus).toLocaleString('en-IN')}.`
      : signal === 'reconsider'
        ? `This is possible but tight. Estimated EMI is Rs ${Math.round(emi).toLocaleString('en-IN')} per month, which uses most of the available monthly surplus.`
        : `This does not look affordable right now. Estimated EMI is Rs ${Math.round(emi).toLocaleString('en-IN')} per month, which is above the available surplus.`

  await ctx.act('affordability_calculated', `Calculated affordability with signal ${signal}`, {
    parameters: { monthly_income: monthlyIncome, property_price: propertyPrice },
    result: { signal, emi: Math.round(emi), surplus: Math.round(surplus) },
  })

  return {
    signal,
    emi: Math.round(emi),
    surplus: Math.round(surplus),
    message,
  }
}
