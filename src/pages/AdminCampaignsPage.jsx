import React, { useEffect, useState } from 'react';
import { adminAPI } from '../lib/api';
import { Megaphone, Send, Users, AlertCircle, CheckCircle, Mail, Search } from 'lucide-react';

const AdminCampaignsPage = () => {
  const [tenants, setTenants] = useState([]);
  const [campaignHistory, setCampaignHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [isComposing, setIsComposing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [campaignForm, setCampaignForm] = useState({
    subject: '',
    body: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const tenantRes = await adminAPI.getTenants();
      setTenants(tenantRes.data || []);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
      setToast({ type: 'error', message: 'Failed to load businesses' });
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectTenant = (tenant) => {
    setSelectedTenant(tenant);
    setIsComposing(true);
  };

  const handleSendCampaign = async () => {
    if (!selectedTenant || !campaignForm.subject.trim() || !campaignForm.body.trim()) {
      setToast({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    try {
      setSubmitting(true);
      await adminAPI.sendBusinessCampaign({
        tenant_id: selectedTenant.id,
        subject: campaignForm.subject,
        body: campaignForm.body
      });

      setCampaignHistory([
        {
          id: Date.now(),
          tenantName: selectedTenant.name,
          subject: campaignForm.subject,
          sentAt: new Date().toISOString(),
          status: 'sent'
        },
        ...campaignHistory
      ]);

      setToast({ type: 'success', message: `Campaign sent to ${selectedTenant.name}` });
      setIsComposing(false);
      setSelectedTenant(null);
      setCampaignForm({ subject: '', body: '' });
    } catch (error) {
      console.error('Failed to send campaign:', error);
      setToast({ type: 'error', message: 'Failed to send campaign' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsComposing(false);
    setSelectedTenant(null);
    setCampaignForm({ subject: '', body: '' });
  };

  if (loading) {
    return <div className="p-8 bg-[#FDFBF7] min-h-screen text-[#57534E]">Loading campaigns...</div>;
  }

  return (
    <div className="p-8 space-y-8 bg-[#FDFBF7] min-h-screen">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg flex items-center gap-2 ${
          toast.type === 'success'
            ? 'bg-[#4A5D23] text-white'
            : 'bg-[#B85C38] text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Megaphone className="w-8 h-8 text-[#B85C38]" />
          <h1 className="text-4xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
            Campaigns
          </h1>
        </div>
        <p className="text-[#57534E]">Send email campaigns to business owners across the platform</p>
      </div>

      {/* Main Content */}
      {!isComposing ? (
        <div className="space-y-8">
          {/* Businesses List Section */}
          <div className="bg-white p-8 rounded-lg border border-[#E7E5E4]">
            <h2 className="text-2xl font-bold text-[#1C1917] mb-6" style={{ fontFamily: 'Cormorant Garamond' }}>
              <Users className="inline-block mr-3 w-6 h-6 text-[#B85C38]" />
              Select a Business
            </h2>
            <p className="text-[#57534E] mb-6">Choose a business to send a campaign email to its owner</p>

            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-[#A8A29E]" />
                <input
                  type="text"
                  placeholder="Search by business name or slug..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-[#E7E5E4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85C38]"
                />
              </div>
            </div>

            {/* Tenants Grid */}
            {filteredTenants.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="p-4 border border-[#E7E5E4] rounded-lg hover:border-[#B85C38] hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleSelectTenant(tenant)}
                  >
                    <div className="mb-3">
                      <h3 className="font-semibold text-[#1C1917]">{tenant.name}</h3>
                      <p className="text-sm text-[#A8A29E]">{tenant.slug}</p>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-[#57534E] uppercase font-semibold">Plan</p>
                        <p className="text-sm font-bold text-[#B85C38]">{tenant.plan}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#57534E] uppercase font-semibold">Customers</p>
                        <p className="text-sm font-bold text-[#1C1917]">{tenant.customer_count || 0}</p>
                      </div>
                    </div>
                    <button className="w-full py-2 bg-[#F3EFE7] hover:bg-[#E7E5E4] text-[#1C1917] rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                      <Send className="w-4 h-4" />
                      Send Campaign
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-[#F3EFE7] rounded-lg">
                <p className="text-[#57534E]">No businesses found</p>
              </div>
            )}
          </div>

          {/* Campaign History Section */}
          {campaignHistory.length > 0 && (
            <div className="bg-white p-8 rounded-lg border border-[#E7E5E4]">
              <h2 className="text-2xl font-bold text-[#1C1917] mb-6" style={{ fontFamily: 'Cormorant Garamond' }}>
                Campaign History
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E7E5E4]">
                      <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Business</th>
                      <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Subject</th>
                      <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Sent Date</th>
                      <th className="py-3 px-4 text-sm font-semibold text-[#57534E]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignHistory.map((campaign) => (
                      <tr key={campaign.id} className="border-b border-[#E7E5E4] hover:bg-[#F3EFE7] transition-colors">
                        <td className="py-3 px-4 font-medium text-[#1C1917]">{campaign.tenantName}</td>
                        <td className="py-3 px-4 text-[#57534E]">{campaign.subject}</td>
                        <td className="py-3 px-4 text-[#57534E]">{new Date(campaign.sentAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#4A5D23] text-white rounded-full text-xs font-semibold">
                            <CheckCircle className="w-3 h-3" />
                            {campaign.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Compose Campaign Form */
        <div className="bg-white p-8 rounded-lg border border-[#E7E5E4] max-w-2xl">
          <h2 className="text-2xl font-bold text-[#1C1917] mb-6" style={{ fontFamily: 'Cormorant Garamond' }}>
            <Mail className="inline-block mr-3 w-6 h-6 text-[#B85C38]" />
            Compose Campaign
          </h2>

          <div className="bg-[#F3EFE7] p-4 rounded-lg mb-6 border border-[#E7E5E4]">
            <p className="text-sm text-[#57534E]">
              <span className="font-semibold">To:</span> {selectedTenant?.name} ({selectedTenant?.slug})
            </p>
          </div>

          {/* Subject */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[#1C1917] mb-2">
              Subject Line
            </label>
            <input
              type="text"
              placeholder="E.g., Spring promotion, new feature announcement..."
              value={campaignForm.subject}
              onChange={(e) => setCampaignForm({ ...campaignForm, subject: e.target.value })}
              className="w-full px-4 py-3 border border-[#E7E5E4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85C38] font-['Manrope']"
            />
          </div>

          {/* Body */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[#1C1917] mb-2">
              Message
            </label>
            <textarea
              placeholder="Write your campaign message to the business owner..."
              value={campaignForm.body}
              onChange={(e) => setCampaignForm({ ...campaignForm, body: e.target.value })}
              rows="8"
              className="w-full px-4 py-3 border border-[#E7E5E4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B85C38] font-['Manrope'] resize-none"
            />
            <p className="text-xs text-[#A8A29E] mt-1">{campaignForm.body.length} characters</p>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="px-6 py-2.5 border border-[#E7E5E4] text-[#1C1917] rounded-lg font-semibold hover:bg-[#F3EFE7] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSendCampaign}
              disabled={submitting || !campaignForm.subject.trim() || !campaignForm.body.trim()}
              className="px-6 py-2.5 bg-[#B85C38] text-white rounded-lg font-semibold hover:bg-[#A34D2C] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Sending...' : 'Send Campaign'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCampaignsPage;
