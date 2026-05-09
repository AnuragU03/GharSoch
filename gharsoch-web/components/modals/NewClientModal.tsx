'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createClientAction } from '@/app/actions/clients';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewClientModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const formData = new FormData(e.currentTarget);
    const result = await createClientAction(formData);

    setLoading(false);

    if (result.success) {
      toast.success('Client created · Converter agent dispatched');
      onClose();
    } else {
      setErrorMsg(result.error || 'Something went wrong');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-xl bg-surface sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {errorMsg && (
            <div className="text-red text-sm font-medium">{errorMsg}</div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Name <span className="text-red">*</span></label>
              <input id="name" name="name" required className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft" />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">Phone <span className="text-red">*</span></label>
              <input id="phone" name="phone" required pattern="^\+91\s?\d{10}$" placeholder="+91" className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft" title="Must be +91 followed by 10 digits" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <input id="email" name="email" type="email" className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft" />
            </div>
            <div className="space-y-2">
              <label htmlFor="source" className="text-sm font-medium">Source</label>
              <select id="source" name="source" className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft">
                <option value="manual">Manual Entry</option>
                <option value="web_form">Web Form</option>
                <option value="csv_upload">CSV Upload</option>
                <option value="referral">Referral</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="property_type" className="text-sm font-medium">Property Type</label>
              <select id="property_type" name="property_type" className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft">
                <option value="1BHK">1 BHK</option>
                <option value="2BHK">2 BHK</option>
                <option value="3BHK">3 BHK</option>
                <option value="4BHK">4 BHK</option>
                <option value="Villa">Villa</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="budget_range" className="text-sm font-medium">Budget</label>
              <input id="budget_range" name="budget_range" placeholder="e.g. 1.2-1.5 Cr" className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft" />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="location_pref" className="text-sm font-medium">Location Preference</label>
            <input id="location_pref" name="location_pref" className="flex h-10 w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft" />
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">Notes</label>
            <textarea id="notes" name="notes" className="flex min-h-[80px] w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft" />
          </div>

          <DialogFooter className="mt-6">
            <button type="button" className="inline-flex h-9 items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2 transition-colors" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow hover:bg-accent/90 transition-colors" disabled={loading}>
              {loading ? 'Dispatching...' : 'Create & dispatch'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
