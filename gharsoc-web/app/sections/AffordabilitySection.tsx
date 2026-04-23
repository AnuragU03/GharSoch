'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Info, 
  DollarSign, 
  Calculator, 
  PieChart, 
  TrendingUp, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react'
import { callAIAgent } from '@/lib/aiAgent'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const SELF_SERVICE_AGENT_ID = '69e8f709f89cad5d4b752d26'

// --- Types ---

interface Tranche {
  name: string
  dueDate: string
  amount: number
  percentage: number
  fundingSource: 'Self' | 'Loan' | 'Both'
}

interface FinancialAdvisorOutput {
  signal: 'Go' | 'Reconsider' | 'No-Go'
  excessRatio: number
  tranches: Array<{
    name: string
    date: string
    due: number
    emi: number
    totalOutflow: number
    surplus: number
    status: 'Comfortable' | 'Tight' | 'Deficit'
  }>
  recommendations: string[]
}

// --- Main Component ---

export default function AffordabilitySection() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FinancialAdvisorOutput | null>(null)

  // Step 1: Property Cost
  const [propertyData, setPropertyData] = useState({
    name: '',
    builder: '',
    costMode: 'Itemised' as 'Lump Sum' | 'Itemised',
    basePrice: 0,
    parking: 0,
    club: 0,
    plc: 0,
    otherCharges: [] as { name: string; amount: number }[],
    gstPct: 5,
    stampDutyPct: 6,
    registration: 0,
  })

  // Step 2: Payment Plan
  const [paymentPlan, setPaymentPlan] = useState({
    propertyType: 'UC' as 'UC' | 'RTM',
    possessionDate: '',
    fundingMethod: 'Partial' as 'Self-Funded' | 'Home Loan' | 'Partial',
    loanAmount: 0,
    interestRate: 8.5,
    tenure: 20,
    emiType: 'Pre-EMI' as 'Pre-EMI' | 'Full EMI',
    tranches: [
      { name: 'Token Amount', dueDate: '', amount: 0, percentage: 10, fundingSource: 'Self' }
    ] as Tranche[],
  })

  // Step 3: Financial Profile
  const [financialProfile, setFinancialProfile] = useState({
    monthlyIncome: 0,
    additionalIncome: [] as { type: string; amount: number }[],
    existingEmis: 0,
    monthlyRent: 0,
    householdExpenses: 0,
    otherCommitments: 0,
  })

  // Calculations
  const itemisedTotal = propertyData.basePrice + propertyData.parking + propertyData.club + propertyData.plc + 
    propertyData.otherCharges.reduce((acc, curr) => acc + curr.amount, 0)
  
  const gstAmount = (itemisedTotal * propertyData.gstPct) / 100
  const stampDutyAmount = (itemisedTotal * propertyData.stampDutyPct) / 100
  const totalCost = itemisedTotal + gstAmount + stampDutyAmount + propertyData.registration

  const totalMonthlyIncome = financialProfile.monthlyIncome + financialProfile.additionalIncome.reduce((acc, curr) => acc + curr.amount, 0)
  const totalExistingOutflow = financialProfile.existingEmis + financialProfile.monthlyRent + financialProfile.householdExpenses + financialProfile.otherCommitments

  const trancheTotalPct = paymentPlan.tranches.reduce((acc, curr) => acc + curr.percentage, 0)

  // Handlers
  const addOtherCharge = () => setPropertyData(prev => ({ ...prev, otherCharges: [...prev.otherCharges, { name: '', amount: 0 }] }))
  const removeOtherCharge = (index: number) => setPropertyData(prev => ({ ...prev, otherCharges: prev.otherCharges.filter((_, i) => i !== index) }))

  const addTranche = () => setPaymentPlan(prev => ({ ...prev, tranches: [...prev.tranches, { name: '', dueDate: '', amount: 0, percentage: 0, fundingSource: 'Self' }] }))
  const removeTranche = (index: number) => setPaymentPlan(prev => ({ ...prev, tranches: prev.tranches.filter((_, i) => i !== index) }))

  const handleAnalyze = async () => {
    setLoading(true)
    try {
      const payload = {
        property: propertyData,
        payment: paymentPlan,
        finances: financialProfile,
        calculated: { totalCost, totalMonthlyIncome, totalExistingOutflow }
      }
      
      const res = await callAIAgent(`Analyze affordability for this buyer: ${JSON.stringify(payload)}. Return a JSON relative to the GharSoch advisory spec.`, SELF_SERVICE_AGENT_ID)
      
      if (res.success) {
        setResult(res.response.result as FinancialAdvisorOutput)
        setStep(4)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // --- Render Steps ---

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center">
          <div 
            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
              step >= s ? 'bg-primary border-primary text-white shadow-[0_0_15px_rgba(255,165,0,0.3)]' : 'border-muted text-muted-foreground'
            }`}
          >
            {step > s ? <Check className="w-5 h-5" /> : s}
          </div>
          {s < 4 && (
            <div className={`w-12 h-0.5 mx-2 ${step > s ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold tracking-tight text-white">GharSoch Advisor</h1>
        <p className="text-muted-foreground mt-2">Professional Grade Real Estate Affordability Intelligence</p>
      </div>

      {renderStepIndicator()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {step === 1 && (
            <Card className="bg-card/50 border-white/5 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl">Step 1: Property Cost</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Property Name</Label>
                    <Input 
                      placeholder="e.g. Prestige Waterford" 
                      value={propertyData.name}
                      onChange={e => setPropertyData(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-black/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Builder Name (Optional)</Label>
                    <Input 
                      placeholder="e.g. Prestige Group" 
                      value={propertyData.builder}
                      onChange={e => setPropertyData(prev => ({ ...prev, builder: e.target.value }))}
                      className="bg-black/20"
                    />
                  </div>
                </div>

                <div className="flex gap-4 p-1 bg-black/20 rounded-lg w-fit">
                  <Button 
                    variant={propertyData.costMode === 'Lump Sum' ? 'default' : 'ghost'}
                    onClick={() => setPropertyData(prev => ({ ...prev, costMode: 'Lump Sum' }))}
                    size="sm"
                  >Lump Sum</Button>
                  <Button 
                    variant={propertyData.costMode === 'Itemised' ? 'default' : 'ghost'}
                    onClick={() => setPropertyData(prev => ({ ...prev, costMode: 'Itemised' }))}
                    size="sm"
                  >Itemised</Button>
                </div>

                {propertyData.costMode === 'Itemised' ? (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Base Price (₹)</Label>
                        <Input type="number" value={propertyData.basePrice} onChange={e => setPropertyData(prev => ({ ...prev, basePrice: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Parking Charges (₹)</Label>
                        <Input type="number" value={propertyData.parking} onChange={e => setPropertyData(prev => ({ ...prev, parking: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Club Membership (₹)</Label>
                        <Input type="number" value={propertyData.club} onChange={e => setPropertyData(prev => ({ ...prev, club: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>PLC (₹)</Label>
                        <Input type="number" value={propertyData.plc} onChange={e => setPropertyData(prev => ({ ...prev, plc: Number(e.target.value) }))} />
                      </div>
                    </div>
                    
                    {propertyData.otherCharges.map((charge, i) => (
                      <div key={i} className="flex gap-2 items-end">
                        <div className="flex-1 space-y-2">
                          <Label>Charge Name</Label>
                          <Input value={charge.name} onChange={e => {
                            const newCharges = [...propertyData.otherCharges]
                            newCharges[i].name = e.target.value
                            setPropertyData(prev => ({ ...prev, otherCharges: newCharges }))
                          }} />
                        </div>
                        <div className="flex-1 space-y-2">
                          <Label>Amount (₹)</Label>
                          <Input type="number" value={charge.amount} onChange={e => {
                            const newCharges = [...propertyData.otherCharges]
                            newCharges[i].amount = Number(e.target.value)
                            setPropertyData(prev => ({ ...prev, otherCharges: newCharges }))
                          }} />
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeOtherCharge(i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addOtherCharge} className="w-full border-dashed">
                      <Plus className="w-4 h-4 mr-2" /> Add Other Charge
                    </Button>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                      <div className="space-y-2">
                        <Label>GST (%)</Label>
                        <Input type="number" value={propertyData.gstPct} onChange={e => setPropertyData(prev => ({ ...prev, gstPct: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Stamp Duty (%)</Label>
                        <Input type="number" value={propertyData.stampDutyPct} onChange={e => setPropertyData(prev => ({ ...prev, stampDutyPct: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Registration (₹)</Label>
                        <Input type="number" value={propertyData.registration} onChange={e => setPropertyData(prev => ({ ...prev, registration: Number(e.target.value) }))} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Lump Sum Total Cost (₹)</Label>
                    <Input type="number" value={propertyData.basePrice} onChange={e => setPropertyData(prev => ({ ...prev, basePrice: Number(e.target.value) }))} />
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button onClick={() => setStep(2)} className="ml-auto">Next <ChevronRight className="w-4 h-4 ml-2" /></Button>
              </CardFooter>
            </Card>
          )}

          {step === 2 && (
            <Card className="bg-card/50 border-white/5 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl">Step 2: Payment Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4 p-1 bg-black/20 rounded-lg w-fit">
                  <Button variant={paymentPlan.propertyType === 'UC' ? 'default' : 'ghost'} onClick={() => setPaymentPlan(prev => ({ ...prev, propertyType: 'UC' }))} size="sm">Under Construction</Button>
                  <Button variant={paymentPlan.propertyType === 'RTM' ? 'default' : 'ghost'} onClick={() => setPaymentPlan(prev => ({ ...prev, propertyType: 'RTM' }))} size="sm">Ready to Move</Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Funding Method</Label>
                    <Select value={paymentPlan.fundingMethod} onValueChange={v => setPaymentPlan(prev => ({ ...prev, fundingMethod: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Self-Funded">Self-Funded</SelectItem>
                        <SelectItem value="Home Loan">Home Loan</SelectItem>
                        <SelectItem value="Partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {paymentPlan.propertyType === 'UC' && (
                    <div className="space-y-2">
                      <Label>Posession Date</Label>
                      <Input type="date" value={paymentPlan.possessionDate} onChange={e => setPaymentPlan(prev => ({ ...prev, possessionDate: e.target.value }))} />
                    </div>
                  )}
                </div>

                {paymentPlan.fundingMethod !== 'Self-Funded' && (
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Calculator className="w-4 h-4 transition-all duration-300" /> Home Loan Configuration</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label>Loan Amount (₹)</Label>
                        <Input type="number" value={paymentPlan.loanAmount} onChange={e => setPaymentPlan(prev => ({ ...prev, loanAmount: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Rate (%)</Label>
                        <Input type="number" step="0.1" value={paymentPlan.interestRate} onChange={e => setPaymentPlan(prev => ({ ...prev, interestRate: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Tenure (Yrs)</Label>
                        <Input type="number" value={paymentPlan.tenure} onChange={e => setPaymentPlan(prev => ({ ...prev, tenure: Number(e.target.value) }))} />
                      </div>
                    </div>
                    {paymentPlan.propertyType === 'UC' && (
                      <div className="flex items-center gap-2">
                        <Label>EMI Type:</Label>
                        <Tabs value={paymentPlan.emiType} onValueChange={v => setPaymentPlan(prev => ({ ...prev, emiType: v as any }))}>
                          <TabsList className="bg-black/40">
                            <TabsTrigger value="Pre-EMI">Pre-EMI (Interest Only)</TabsTrigger>
                            <TabsTrigger value="Full EMI">Full EMI</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Tranche Builder</h3>
                    <Badge variant={trancheTotalPct === 100 ? 'default' : 'destructive'}>{trancheTotalPct}% Allocated</Badge>
                  </div>
                  
                  {paymentPlan.tranches.map((t, i) => (
                    <div key={i} className="flex gap-3 items-end p-3 bg-black/10 rounded-lg border border-white/5">
                      <div className="flex-1 space-y-2">
                        <Label className="text-[10px] uppercase text-muted-foreground">Name</Label>
                        <Input value={t.name} onChange={e => {
                          const nt = [...paymentPlan.tranches]; nt[i].name = e.target.value;
                          setPaymentPlan(prev => ({ ...prev, tranches: nt }))
                        }} className="h-8" />
                      </div>
                      <div className="w-20 space-y-2">
                        <Label className="text-[10px] uppercase text-muted-foreground">%</Label>
                        <Input type="number" value={t.percentage} onChange={e => {
                          const nt = [...paymentPlan.tranches]; nt[i].percentage = Number(e.target.value);
                          setPaymentPlan(prev => ({ ...prev, tranches: nt }))
                        }} className="h-8" />
                      </div>
                      <div className="w-32 space-y-2">
                        <Label className="text-[10px] uppercase text-muted-foreground">Source</Label>
                        <Select value={t.fundingSource} onValueChange={v => {
                          const nt = [...paymentPlan.tranches]; nt[i].fundingSource = v as any;
                          setPaymentPlan(prev => ({ ...prev, tranches: nt }))
                        }}>
                          <SelectTrigger className="h-8 text-[11px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Self">Self</SelectItem>
                            <SelectItem value="Loan">Loan</SelectItem>
                            <SelectItem value="Both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeTranche(i)} className="h-8 w-8"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addTranche} className="w-full py-6 border-dashed opacity-60 hover:opacity-100">
                    <Plus className="w-4 h-4 mr-2" /> Add Tranche Stage
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={() => setStep(3)}>Next <ChevronRight className="w-4 h-4 ml-2" /></Button>
              </CardFooter>
            </Card>
          )}

          {step === 3 && (
            <Card className="bg-card/50 border-white/5 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl">Step 3: Financial Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-lg">Primary Monthly Income (₹)</Label>
                      <Input 
                        type="number" 
                        value={financialProfile.monthlyIncome} 
                        onChange={e => setFinancialProfile(prev => ({ ...prev, monthlyIncome: Number(e.target.value) }))}
                        className="h-12 text-xl font-bold border-primary/20 bg-primary/5"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm text-muted-foreground">Additional Income Sources</Label>
                      {financialProfile.additionalIncome.map((inc, i) => (
                        <div key={i} className="flex gap-2">
                          <Input value={inc.type} onChange={e => {
                            const ni = [...financialProfile.additionalIncome]; ni[i].type = e.target.value;
                            setFinancialProfile(prev => ({ ...prev, additionalIncome: ni }))
                          }} placeholder="Type" />
                          <Input type="number" value={inc.amount} onChange={e => {
                            const ni = [...financialProfile.additionalIncome]; ni[i].amount = Number(e.target.value);
                            setFinancialProfile(prev => ({ ...prev, additionalIncome: ni }))
                          }} placeholder="Amount" />
                          <Button variant="ghost" size="icon" onClick={() => setFinancialProfile(prev => ({ ...prev, additionalIncome: prev.additionalIncome.filter((_, idx) => idx !== i) }))}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setFinancialProfile(prev => ({ ...prev, additionalIncome: [...prev.additionalIncome, { type: '', amount: 0 }] }))} className="w-full border-dashed">
                        <Plus className="w-4 h-4 mr-2" /> Add Income Source
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 md:pt-0">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-red-300"><AlertTriangle className="w-4 h-4" /> Monthly Obligations</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Existing EMIs (₹)</Label>
                        <Input type="number" value={financialProfile.existingEmis} onChange={e => setFinancialProfile(prev => ({ ...prev, existingEmis: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Monthly Rent (₹)</Label>
                        <Input type="number" value={financialProfile.monthlyRent} onChange={e => setFinancialProfile(prev => ({ ...prev, monthlyRent: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Household Exp. (₹)</Label>
                        <Input type="number" value={financialProfile.householdExpenses} onChange={e => setFinancialProfile(prev => ({ ...prev, householdExpenses: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Other Commits. (₹)</Label>
                        <Input type="number" value={financialProfile.otherCommitments} onChange={e => setFinancialProfile(prev => ({ ...prev, otherCommitments: Number(e.target.value) }))} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4 mr-2" /> Back</Button>
                <Button onClick={handleAnalyze} disabled={loading || totalMonthlyIncome === 0} className="bg-primary hover:bg-primary/90 text-white px-8 py-6 h-auto text-lg shadow-lg shadow-primary/20">
                  {loading ? 'Analyzing Intelligence...' : 'Generate AI Advisory'}
                  {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
                </Button>
              </CardFooter>
            </Card>
          )}

          {step === 4 && result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <Card className="bg-gradient-to-br from-card to-card/50 border-white/10 shadow-2xl overflow-hidden relative">
                 <div className={`absolute top-0 left-0 w-2 h-full ${
                   result.signal === 'Go' ? 'bg-emerald-500' : 
                   result.signal === 'Reconsider' ? 'bg-amber-500' : 'bg-destructive'
                 }`} />
                 
                 <CardContent className="pt-8 pb-10">
                   <div className="text-center space-y-4">
                     <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full border-2 text-xl font-bold ${
                       result.signal === 'Go' ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10' : 
                       result.signal === 'Reconsider' ? 'border-amber-500/50 text-amber-500 bg-amber-500/10' : 
                       'border-destructive/50 text-destructive bg-destructive/10'
                     }`}>
                       {result.signal === 'Go' ? <Check className="w-6 h-6" /> : 
                        result.signal === 'Reconsider' ? <Info className="w-6 h-6" /> : <X className="w-6 h-6" />}
                       {result.signal.toUpperCase()} SIGNAL
                     </div>
                     <p className="text-4xl font-black text-white tracking-tighter">
                       Excess Ratio: <span className={result.excessRatio > 60 ? 'text-destructive' : 'text-primary'}>{result.excessRatio}%</span>
                     </p>
                     <p className="text-muted-foreground max-w-md mx-auto">
                       {result.signal === 'Go' ? 'This property fits comfortably within your financial boundaries.' : 
                        result.signal === 'Reconsider' ? 'Proceed with caution. Financial restructuring may be required.' : 
                        'Serious budget mismatch detected based on current financial profile.'}
                     </p>
                   </div>
                 </CardContent>
               </Card>

               <div className="grid grid-cols-1 gap-6">
                 <Card className="bg-card border-white/5">
                   <CardHeader>
                     <CardTitle className="text-lg flex items-center gap-2 text-primary">
                       <TrendingUp className="w-5 h-5" /> Tranche-wise Outflow Analysis
                     </CardTitle>
                   </CardHeader>
                   <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs uppercase text-muted-foreground border-b border-white/5">
                            <tr>
                              <th className="py-3 px-2">Stage</th>
                              <th className="py-3 px-2 text-right">Due (₹)</th>
                              <th className="py-3 px-2 text-right">EMI (₹)</th>
                              <th className="py-3 px-2 text-right">Total Outflow (₹)</th>
                              <th className="py-3 px-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {result.tranches.map((t, idx) => (
                              <tr key={idx} className="hover:bg-white/5 transition-colors">
                                <td className="py-4 px-2 font-medium">{t.name}</td>
                                <td className="py-4 px-2 text-right font-mono">₹{(t.due/100000).toFixed(1)}L</td>
                                <td className="py-4 px-2 text-right font-mono">₹{t.emi.toLocaleString()}</td>
                                <td className="py-4 px-2 text-right font-bold font-mono">₹{t.totalOutflow.toLocaleString()}</td>
                                <td className="py-4 px-2 text-center">
                                  <Badge className={
                                    t.status === 'Comfortable' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    t.status === 'Tight' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                    'bg-destructive/10 text-destructive border-destructive/20'
                                  }>{t.status}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                   </CardContent>
                 </Card>

                 <Card className="bg-card border-white/5">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-primary">
                        <PieChart className="w-5 h-5" /> Income vs Outflow Tracking
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={result.tranches}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                          <XAxis dataKey="name" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="totalOutflow" fill="hsl(25, 70%, 45%)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                 </Card>
               </div>

                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-white">
                      <Sparkles className="w-5 h-5 text-primary" /> Strategized Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {result.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-2 pb-6">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 shadow-xl shadow-primary/30">
                      Unlock Full Financial Report - ₹999
                    </Button>
                  </CardFooter>
                </Card>

                <Button variant="ghost" onClick={() => setStep(1)} className="w-full text-muted-foreground flex items-center justify-center gap-2">
                   <RotateCcw className="w-4 h-4" /> Start New Assessment
                </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-black/40 border-white/5">
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Running Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-end border-b border-white/5 pb-3">
                <span className="text-sm text-muted-foreground">Total Property Cost</span>
                <span className="text-xl font-bold text-white">₹{(totalCost/100000).toFixed(1)}L</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground italic">
                  <span>Base: ₹{(itemisedTotal/100000).toFixed(1)}L</span>
                  <span>GST+Stamp: ₹{((gstAmount + stampDutyAmount)/100000).toFixed(1)}L</span>
                </div>
              </div>
              
              {paymentPlan.fundingMethod !== 'Self-Funded' && (
                <div className="flex justify-between items-end border-b border-white/5 pb-3 pt-2">
                  <span className="text-sm text-muted-foreground">Est. EMI</span>
                  <span className="text-lg font-bold text-primary">₹{Math.round(paymentPlan.loanAmount * 0.008).toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between items-end pt-2">
                <span className="text-sm text-muted-foreground">Total Monthly Income</span>
                <span className="text-lg font-bold text-emerald-400">₹{(totalMonthlyIncome/1000).toFixed(0)}K</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Why GharSoch?</h4>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">Accurate GST, Stamp Duty & Registration calculation based on state policies.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">Phase-wise tranche mapping ensures you're liquid at every stage of construction.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Helper icons (lucide doesn't have all)
function X(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  )
}

function RotateCcw(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
  )
}

function Sparkles(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
  )
}
