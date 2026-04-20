import React, { useState, useEffect, useRef } from 'react';
import { ownerAPI } from '../lib/api';
import { Send, Zap, TrendingUp, Users, MessageCircle, Sparkles } from 'lucide-react';

const AIAssistantPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenantData, setTenantData] = useState(null);
  const [userPlan, setUserPlan] = useState('basic');
  const [queriesUsed, setQueriesUsed] = useState(0);
  const [queryLimit, setQueryLimit] = useState(0);
  const messagesEndRef = useRef(null);

  // Plan-based query limits
  const QUERY_LIMITS = {
    basic: 0,
    gold: 20,
    vip: 35,
  };

  useEffect(() => {
    // Fetch tenant info to determine plan
    ownerAPI.getTenant().then(res => {
      if (res.data) {
        setTenantData(res.data);
        const plan = res.data.plan?.toLowerCase() || 'basic';
        setUserPlan(plan);
        setQueryLimit(QUERY_LIMITS[plan] || 0);
        // In a real app, you'd fetch the actual queries used today
        setQueriesUsed(0);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate contextual mock AI response
  const generateAIResponse = (userMessage) => {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('inactive') || lowerMessage.includes('customer')) {
      return `Based on your loyalty data, I recommend launching a re-engagement campaign targeting customers who haven't visited in the last 30 days. Consider offering a 15% discount or exclusive reward on their next visit. This typically increases inactive customer visits by 25-40%.`;
    }

    if (lowerMessage.includes('campaign')) {
      return `For your next campaign, I suggest segmenting by visit frequency. Target your top 20% most-visited customers with a VIP exclusive offer, and your inactive segment with a "welcome back" promotion. This dual approach typically achieves 30-45% engagement rates.`;
    }

    if (lowerMessage.includes('analytics') || lowerMessage.includes('visits') || lowerMessage.includes('data')) {
      return `Your analytics show peak visit times on weekends (Saturday 2-5 PM). Consider scheduling special promotions during off-peak hours to balance foot traffic. Your average customer visits 2.3 times per month, with top-tier customers visiting 5+ times.`;
    }

    return `I recommend focusing on customer retention and visit frequency. You could increase average visit value by 20% through targeted promotions and personalized offers. Would you like help designing a specific campaign?`;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Check if user has queries available
    if (userPlan === 'basic' || queriesUsed >= queryLimit) {
      const response = 'Upgrade to Gold or VIP plan to use AI Assistant. Gold: 20 queries/day, VIP: 35 queries/day.';
      setMessages([...messages, { role: 'user', content: inputValue }, { role: 'assistant', content: response }]);
      setInputValue('');
      return;
    }

    // Add user message
    const userMsg = inputValue;
    setMessages([...messages, { role: 'user', content: userMsg }]);
    setInputValue('');
    setLoading(true);

    try {
      // Call API
      const response = await ownerAPI.aiQuery({ message: userMsg });
      const aiResponse = response.data?.response || generateAIResponse(userMsg);

      // Add AI response
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse, canCampaign: true }]);
      setQueriesUsed(prev => prev + 1);
    } catch (error) {
      console.error('AI Query failed:', error);
      const fallbackResponse = generateAIResponse(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: fallbackResponse, canCampaign: true }]);
      setQueriesUsed(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaignFromResponse = (responseText) => {
    // In a real app, this would navigate to campaigns page with pre-filled content
    console.log('Create campaign from:', responseText);
    alert('Campaign creation feature coming soon!');
  };

  // Basic plan message
  if (userPlan === 'basic') {
    return (
      <div className="p-8 bg-[#FDFBF7] min-h-screen flex flex-col items-center justify-center">
        <style>{`
          * {
            font-family: 'Manrope', sans-serif;
          }
          h1, h2, h3 {
            font-family: 'Cormorant Garamond', serif;
          }
        `}</style>

        <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F3EFE7] mb-6">
            <Sparkles className="w-8 h-8 text-[#B85C38]" />
          </div>
          <h1 className="text-3xl font-['Cormorant_Garamond'] font-bold text-[#1C1917] mb-3">AI Assistant</h1>
          <p className="text-[#57534E] mb-8">Get AI-powered insights for your loyalty program and create targeted campaigns instantly.</p>

          <div className="bg-white p-6 rounded-2xl border border-[#E7E5E4] mb-8">
            <p className="text-sm font-bold uppercase tracking-wide text-[#1C1917] mb-4">Upgrade to use AI</p>
            <div className="space-y-3 text-left mb-6">
              <div className="flex items-center gap-3">
                <span className="text-[#E3A869] font-bold">20</span>
                <span className="text-[#57534E]">Queries per day</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#E3A869] font-bold">35</span>
                <span className="text-[#57534E]">Queries per day</span>
              </div>
            </div>
          </div>

          <button className="w-full py-3 bg-[#B85C38] text-white font-bold rounded-lg hover:bg-[#9C4E2F] transition-colors">
            Upgrade Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#FDFBF7] min-h-screen flex flex-col items-center">
      <style>{`
        * {
          font-family: 'Manrope', sans-serif;
        }
        h1, h2, h3 {
          font-family: 'Cormorant Garamond', serif;
        }
      `}</style>

      <div className="w-full max-w-3xl flex flex-col h-screen max-h-screen">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-['Cormorant_Garamond'] font-bold text-[#1C1917] mb-2 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-[#B85C38]" />
            AI Assistant
          </h1>
          <p className="text-[#57534E] text-sm">Get instant insights and create campaigns</p>
          <div className="mt-4 p-3 bg-white rounded-lg border border-[#E7E5E4] inline-block">
            <p className="text-sm font-bold text-[#1C1917]">
              <span className="text-[#B85C38]">{queriesUsed}</span> of <span className="text-[#B85C38]">{queryLimit}</span> queries used today
            </p>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 bg-white rounded-2xl border border-[#E7E5E4] p-6 mb-6 overflow-y-auto space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F3EFE7] mb-4">
                <MessageCircle className="w-7 h-7 text-[#B85C38]" />
              </div>
              <h3 className="text-lg font-bold text-[#1C1917] mb-2">No conversations yet</h3>
              <p className="text-[#57534E] text-sm max-w-xs">Ask about customer retention, campaign ideas, or loyalty analytics</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-5 py-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-[#B85C38] text-white rounded-br-none'
                    : 'bg-[#F3EFE7] text-[#1C1917] rounded-bl-none'
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#F3EFE7] text-[#1C1917] px-5 py-3 rounded-2xl rounded-bl-none">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-[#B85C38] rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-[#B85C38] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-[#B85C38] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {queriesUsed < queryLimit && (
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about campaigns, customers, analytics..."
                className="flex-1 px-4 py-3 rounded-xl border border-[#E7E5E4] focus:border-[#B85C38] focus:ring-0 outline-none text-sm"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="px-4 py-3 bg-[#B85C38] text-white rounded-xl hover:bg-[#9C4E2F] disabled:opacity-50 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#57534E]">
              Queries remaining: <span className="font-bold text-[#B85C38]">{queryLimit - queriesUsed}</span>
            </p>
          </form>
        )}

        {queriesUsed >= queryLimit && (
          <div className="p-4 bg-[#F3EFE7] rounded-xl border border-[#E7E5E4] text-center">
            <p className="text-sm font-bold text-[#1C1917]">Daily query limit reached</p>
            <p className="text-xs text-[#57534E] mt-1">Check back tomorrow or upgrade your plan</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistantPage;
