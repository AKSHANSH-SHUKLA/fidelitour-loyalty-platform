import React, { useState } from 'react';
import api from '../lib/api';
import { Send, Bot, Mail, Sparkles } from 'lucide-react';
import { PageHeader, C as C_PS } from '../components/PageShell';

const AdminAIAssistantPage = () => {
  const [query, setQuery] = useState('');
  const [chatLog, setChatLog] = useState([
    { role: 'ai', text: "Welcome to the Overlord AI matrix. I am analyzing the global tenant database right now. How can I assist you in optimizing platform revenue today?", timestamp: "Just now", type: 'chat' }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMsg = { role: 'user', text: query, timestamp: "Just now", type: 'chat' };
    setChatLog([...chatLog, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await api.post('/admin/ai-query', { message: userMsg.text });
      
      const aiResponse = { role: 'ai', text: res.data.reply, timestamp: "Just now", type: 'chat' };
      setChatLog(prev => [...prev, aiResponse]);
      
      // If it suggested an email draft, let's artificially inject an interactive email block
      if (res.data.reply.includes("draft an email") || res.data.reply.includes("Boulangerie")) {
          setTimeout(() => {
              const draftAction = { 
                  role: 'ai', 
                  type: 'draft', 
                  target: 'Boulangerie Saint-Michel',
                  subject: 'Scaling your Loyalty Program with Gold',
                  body: 'Hi Owner,\n\nI noticed you are rapidly approaching the 500 customer limit on your Basic plan. To ensure your customers keep joining without interruption, I highly recommend upgrading to the Gold tier.\n\nBest,\nPlatform Admin'
              };
              setChatLog(prev => [...prev, draftAction]);
          }, 800);
      }

    } catch (error) {
       setChatLog(prev => [...prev, { role: 'ai', text: "Error communicating with intelligence network.", timestamp: "Just now", type: 'chat' }]);
    } finally {
      setLoading(false);
    }
  };

  const deployMail = () => {
      alert("Deployment hook fired. (Mock Email deployed to Tenant)");
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col space-y-4">
      <PageHeader
        eyebrow="Overlord"
        title="AI Intelligence"
        description="Ask for upsell opportunities, churn risks, and automated outreach drafts — analyzed across every tenant."
        role="super_admin"
      />

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-[var(--border,_#ECEFF4)] flex flex-col overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {chatLog.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              
              {msg.type === 'chat' && (
                  <>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-[var(--blue-deep,_#1453BD)] text-white' : 'bg-[var(--surface-2,_#F8F9FC)] text-[var(--blue-deep,_#1453BD)]'}`}>
                        {msg.role === 'user' ? 'U' : <Bot className="w-5 h-5" />}
                      </div>
                      <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-[var(--blue-deep,_#1453BD)] text-white' : 'bg-[var(--surface-1,_#FFFFFF)] border border-[var(--border,_#ECEFF4)] text-[var(--ink-head,_#030E1D)]'}`}>
                        <p className="leading-relaxed">{msg.text}</p>
                      </div>
                  </>
              )}

              {msg.type === 'draft' && (
                  <div className="ml-14 w-full bg-blue-50 border border-blue-200 p-6 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-2 mb-4 text-[var(--ink-head,_#030E1D)] font-bold">
                          <Mail className="w-5 h-5 text-blue-600"/> Auto-Generated Draft for: {msg.target}
                      </div>
                      <input className="w-full mb-3 p-2 rounded border border-blue-200 text-sm font-bold" defaultValue={msg.subject} />
                      <textarea className="w-full h-32 p-3 rounded border border-blue-200 text-sm leading-relaxed" defaultValue={msg.body}></textarea>
                      <div className="mt-4 flex justify-end gap-3">
                          <button className="px-4 py-2 bg-white border border-blue-200 text-[var(--ink-body,_#556272)] rounded-full text-sm font-semibold hover:bg-gray-50 transition-colors">Discard</button>
                          <button onClick={deployMail} className="px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">Deploy Email Now</button>
                      </div>
                  </div>
              )}
            </div>
          ))}
          {loading && (
             <div className="flex gap-4">
               <div className="w-10 h-10 rounded-full bg-[var(--surface-2,_#F8F9FC)] text-[var(--blue-deep,_#1453BD)] flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 animate-pulse" />
               </div>
               <div className="p-4 rounded-2xl bg-[var(--surface-1,_#FFFFFF)] border border-[var(--border,_#ECEFF4)] text-[var(--ink-muted,_#626F7E)] animate-pulse">
                  Analyzing tensors...
               </div>
             </div>
          )}
        </div>

        <div className="p-4 bg-[var(--surface-2,_#F8F9FC)] border-t border-[var(--border-strong,_#CBD3DC)]">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto relative">
            <input 
              type="text" 
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask who to upsell today..."
              className="w-full pl-6 pr-14 py-4 rounded-full border border-[var(--border-strong,_#CBD3DC)] focus:ring-2 focus:ring-[var(--blue,_#0F6FDE)] focus:border-transparent outline-none shadow-sm"
              disabled={loading}
            />
            <button 
                type="submit" 
                disabled={loading || !query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[var(--blue,_#0F6FDE)] hover:bg-[var(--blue-pressed,_#0D62C4)] disabled:bg-[var(--ink-muted,_#626F7E)] text-white rounded-full flex items-center justify-center transition-colors shadow-md"
            >
              <Send className="w-4 h-4 ml-1" />
            </button>
          </form>
          <div className="text-center mt-3 text-xs text-[var(--ink-muted,_#626F7E)]">AI models can make errors regarding statistics. Use discretion before deploying campaigns.</div>
        </div>
      </div>
    </div>
  );
};
export default AdminAIAssistantPage;
