import React, { useEffect, useState } from 'react';
import { ownerAPI } from '../lib/api';
import {
  AlertTriangle, TrendingDown, Euro, Users, Clock, MapPin, Calendar,
  Send, UserPlus, Trash2, CreditCard, Zap, RefreshCw, ChevronRight, X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

// Small reusable card shell
const Card = ({ children, className = '' }) => (
  <div className={`bg-white border border-[#E7E5E4] rounded-xl p-5 ${className}`}>{children}</div>
);

const SectionHead = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-start gap-3 mb-4">
    <div className="w-10 h-10 rounded-lg bg-[#B85C38]/10 flex items-center justify-center shrink-0">
      <Icon className="w-5 h-5 text-[#B85C38]" />
    </div>
    <div>
      <h2 className="text-lg font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>{title}</h2>
      {subtitle && <p className="text-xs text-[#57534E]">{subtitle}</p>}
    </div>
  </div>
);

const StatPill = ({ label, value, hint, tone = 'default' }) => {
  const toneMap = {
    default: 'bg-[#F3EFE7] text-[#1C1917]',
    danger:  'bg-red-50 text-[#991B1B]',
    warning: 'bg-amber-50 text-[#92400E]',
    success: 'bg-emerald-50 text-[#065F46]',
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${toneMap[tone]}`}>
      <p className="text-xs uppercase tracking-wide font-semibold opacity-75">{label}</p>
      <p className="text-xl font-bold leading-tight">{value}</p>
      {hint && <p className="text-[10px] opacity-70 mt-0.5">{hint}</p>}
    </div>
  );
};

export default function InsightsPage() {
  const [alerts, setAlerts] = useState([]);
  const [churn, setChurn] = useState(null);
  const [ltv, setLtv] = useState(null);
  const [timeSeg, setTimeSeg] = useState(null);
  const [city, setCity] = useState(null);
  const [activeCards, setActiveCards] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [reactivation, setReactivation] = useState(null);
  const [team, setTeam] = useState([]);
  const [senderName, setSenderName] = useState('');
  const [senderNameSaving, setSenderNameSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addTeamForm, setAddTeamForm] = useState({ email: '', password: '', role: 'staff' });

  const loadAll = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      ownerAPI.getAlerts(),
      ownerAPI.getChurn(),
      ownerAPI.getLTV(),
      ownerAPI.getTimeSegmentation(),
      ownerAPI.getCityBreakdown(),
      ownerAPI.getActiveCards(),
      ownerAPI.getMonthlyReport(),
      ownerAPI.getReactivationTemplates(),
      ownerAPI.listTeam(),
      ownerAPI.getTenant(),
    ]);
    const [a, ch, l, t, c, ac, mr, rt, tm, tenant] = results;
    if (a.status === 'fulfilled') setAlerts(a.value.data.alerts || []);
    if (ch.status === 'fulfilled') setChurn(ch.value.data);
    if (l.status === 'fulfilled') setLtv(l.value.data);
    if (t.status === 'fulfilled') setTimeSeg(t.value.data);
    if (c.status === 'fulfilled') setCity(c.value.data);
    if (ac.status === 'fulfilled') setActiveCards(ac.value.data);
    if (mr.status === 'fulfilled') setMonthly(mr.value.data);
    if (rt.status === 'fulfilled') setReactivation(rt.value.data);
    if (tm.status === 'fulfilled') setTeam(tm.value.data.members || []);
    if (tenant.status === 'fulfilled') {
      setSenderName(tenant.value.data?.campaign_sender_name || tenant.value.data?.name || '');
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const saveSenderName = async () => {
    setSenderNameSaving(true);
    try {
      await ownerAPI.updateSenderName(senderName);
      alert('Sender name saved.');
    } catch (e) {
      alert('Failed to save sender name: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSenderNameSaving(false);
    }
  };

  const addTeamMember = async (e) => {
    e.preventDefault();
    try {
      await ownerAPI.addTeamMember(addTeamForm);
      setAddTeamForm({ email: '', password: '', role: 'staff' });
      const tm = await ownerAPI.listTeam();
      setTeam(tm.data.members || []);
    } catch (e) {
      alert('Failed: ' + (e?.response?.data?.detail || e.message));
    }
  };

  const removeTeamMember = async (email) => {
    if (!confirm(`Remove ${email}?`)) return;
    try {
      await ownerAPI.removeTeamMember(email);
      setTeam((prev) => prev.filter((m) => m.email !== email));
    } catch (e) {
      alert('Failed: ' + (e?.response?.data?.detail || e.message));
    }
  };

  if (loading) {
    return <div className="p-8 text-[#57534E]">Loading insights…</div>;
  }

  const alertToneBg = {
    danger: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    success: 'bg-emerald-50 border-emerald-200',
    info: 'bg-sky-50 border-sky-200',
  };

  return (
    <div className="p-8 space-y-6 bg-[#FDFBF7] min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1C1917]" style={{ fontFamily: 'Cormorant Garamond' }}>
            Insights
          </h1>
          <p className="text-sm text-[#57534E]">Everything the platform has learned about your customers.</p>
        </div>
        <button
          onClick={loadAll}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E7E5E4] rounded-lg text-sm hover:bg-[#F3EFE7]"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Feature 3: Smart Alerts */}
      <Card>
        <SectionHead icon={AlertTriangle} title="Alertes intelligentes" subtitle="Ce qui mérite votre attention maintenant" />
        {alerts.length === 0 ? (
          <p className="text-sm text-[#57534E]">Aucune alerte — votre activité est stable.</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${alertToneBg[a.level] || 'bg-[#F3EFE7] border-[#E7E5E4]'}`}>
                <div className="text-2xl">{a.icon}</div>
                <div className="flex-1">
                  <p className="font-semibold text-[#1C1917]">{a.title}</p>
                  <p className="text-sm text-[#57534E]">{a.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Feature 1 + 7: Churn */}
      {churn && (
        <Card>
          <SectionHead icon={TrendingDown} title="Churn & rétention" subtitle="Combien de clients vous perdez, et quand." />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatPill label="Clients total" value={churn.total_customers} />
            <StatPill
              label="1 visite seulement"
              value={`${churn.one_visit_only_pct}%`}
              hint={`${churn.one_visit_only} clients`}
              tone={churn.one_visit_only_pct >= 25 ? 'warning' : 'default'}
            />
            <StatPill
              label="Inactifs 30j"
              value={`${churn.inactive_30d_pct}%`}
              hint={`${churn.inactive_30d} clients`}
              tone={churn.inactive_30d_pct >= 30 ? 'warning' : 'default'}
            />
            <StatPill
              label="Churned 90j"
              value={`${churn.churned_90d_pct}%`}
              hint={`${churn.churned_90d} clients`}
              tone={churn.churned_90d_pct >= 30 ? 'danger' : 'default'}
            />
          </div>
          <p className="text-xs text-[#57534E] mt-4 border-t border-[#E7E5E4] pt-3">
            "1 visite seulement" = clients venus une seule fois qui ne sont pas revenus. "Inactifs 30j" = n'ont pas visité depuis 30 jours.
          </p>
        </Card>
      )}

      {/* Feature 2: LTV */}
      {ltv && (
        <Card>
          <SectionHead icon={Euro} title="Lifetime Value (LTV)" subtitle="Combien un client rapporte en moyenne." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <StatPill label="LTV moyenne" value={`${ltv.average_ltv}€`} />
            <StatPill label="LTV médiane" value={`${ltv.median_ltv}€`} />
            <StatPill label="Top 10% LTV" value={`${ltv.top_10_pct_ltv}€`} tone="success" />
          </div>
          {ltv.by_tier?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E7E5E4]">
                    <th className="text-left py-2 px-2 text-[#57534E] font-semibold">Tier</th>
                    <th className="text-right py-2 px-2 text-[#57534E] font-semibold">Clients</th>
                    <th className="text-right py-2 px-2 text-[#57534E] font-semibold">LTV moyenne</th>
                    <th className="text-right py-2 px-2 text-[#57534E] font-semibold">Revenu total</th>
                  </tr>
                </thead>
                <tbody>
                  {ltv.by_tier.map((row) => (
                    <tr key={row.tier} className="border-b border-[#F3EFE7]">
                      <td className="py-2 px-2 capitalize font-medium">{row.tier}</td>
                      <td className="py-2 px-2 text-right">{row.count}</td>
                      <td className="py-2 px-2 text-right">{row.average_ltv}€</td>
                      <td className="py-2 px-2 text-right">{row.total_revenue}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Feature 12: Active cards + upgrade prompt */}
      {activeCards && (
        <Card>
          <SectionHead icon={CreditCard} title="Cartes actives" subtitle="Utilisation de votre plan" />
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold">{activeCards.active_cards} / {activeCards.plan_cap}</span>
                <span className="text-[#57534E]">{activeCards.usage_pct}% utilisé</span>
              </div>
              <div className="h-3 bg-[#F3EFE7] rounded-full overflow-hidden">
                <div
                  className={`h-full ${activeCards.near_limit ? 'bg-[#B85C38]' : 'bg-[#4A5D23]'}`}
                  style={{ width: `${Math.min(activeCards.usage_pct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-[#57534E] mt-2">Plan actuel : <span className="uppercase font-semibold">{activeCards.plan}</span></p>
            </div>
          </div>
          {activeCards.suggest_upgrade && (
            <div className="mt-4 p-3 bg-[#B85C38]/10 border border-[#B85C38]/30 rounded-lg">
              <p className="font-semibold text-[#B85C38]">
                ⚡ Vous approchez de votre limite. Passez à <span className="uppercase">{activeCards.next_plan}</span> pour {activeCards.next_plan_cap?.toLocaleString()} cartes max ({activeCards.next_plan_price}€/mois).
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Feature 4: Time segmentation */}
      {timeSeg && (
        <Card>
          <SectionHead icon={Clock} title="Segmentation horaire" subtitle="Clients du midi vs soir vs week-end" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs uppercase font-semibold text-[#57534E] mb-2">Par moment</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeSeg.daypart_breakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                    <XAxis dataKey="name" stroke="#57534E" fontSize={11} />
                    <YAxis stroke="#57534E" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="visits" fill="#B85C38" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-[#57534E] mb-2">Par jour de semaine</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeSeg.weekday_breakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                    <XAxis dataKey="day" stroke="#57534E" fontSize={11} />
                    <YAxis stroke="#57534E" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="visits" fill="#4A5D23" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatPill label="Visites weekend" value={timeSeg.weekend_visits} tone="success" />
            <StatPill label="Visites semaine" value={timeSeg.weekday_visits} />
          </div>
        </Card>
      )}

      {/* Feature 5: City breakdown */}
      {city && (
        <Card>
          <SectionHead icon={MapPin} title="Base de données par ville" subtitle={`${city.unique_postal_codes} codes postaux uniques`} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase font-semibold text-[#57534E] mb-2">Top départements</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {city.by_departement.slice(0, 10).map((d) => (
                  <div key={d.code} className="flex justify-between px-3 py-2 rounded bg-[#F3EFE7]">
                    <span><span className="font-mono text-xs text-[#B85C38]">{d.code}</span> {d.name}</span>
                    <span className="font-semibold">{d.customer_count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-[#57534E] mb-2">Top codes postaux</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {city.by_postal_code.slice(0, 10).map((p) => (
                  <div key={p.postal_code} className="flex justify-between px-3 py-2 rounded bg-[#F3EFE7]">
                    <span className="font-mono">{p.postal_code}</span>
                    <span className="font-semibold">{p.customer_count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Feature 10: Monthly report */}
      {monthly && (
        <Card>
          <SectionHead icon={Calendar} title={`Compte-rendu — ${monthly.month_label}`} subtitle="Récap automatique du mois dernier" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatPill
              label="Visites"
              value={monthly.totals.visits}
              hint={monthly.totals.visits_delta_pct != null ? `${monthly.totals.visits_delta_pct > 0 ? '+' : ''}${monthly.totals.visits_delta_pct}% vs mois dernier` : '—'}
              tone={monthly.totals.visits_delta_pct > 0 ? 'success' : monthly.totals.visits_delta_pct < 0 ? 'danger' : 'default'}
            />
            <StatPill
              label="Nouveaux clients"
              value={monthly.totals.new_customers}
              hint={monthly.totals.new_customers_delta_pct != null ? `${monthly.totals.new_customers_delta_pct > 0 ? '+' : ''}${monthly.totals.new_customers_delta_pct}%` : '—'}
            />
            <StatPill label="Revenu" value={`${monthly.totals.revenue}€`} />
            <StatPill label="Panier moyen" value={`${monthly.totals.avg_basket}€`} />
          </div>
          {monthly.campaigns.length > 0 && (
            <div>
              <p className="text-xs uppercase font-semibold text-[#57534E] mb-2">Campagnes du mois</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E7E5E4]">
                      <th className="text-left py-1 px-2">Nom</th>
                      <th className="text-right py-1 px-2">Ciblés</th>
                      <th className="text-right py-1 px-2">Livrés</th>
                      <th className="text-right py-1 px-2">Ouvertures</th>
                      <th className="text-right py-1 px-2">Clics</th>
                      <th className="text-right py-1 px-2">Visites</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.campaigns.map((c, i) => (
                      <tr key={i} className="border-b border-[#F3EFE7]">
                        <td className="py-1 px-2">{c.name}</td>
                        <td className="py-1 px-2 text-right">{c.targeted}</td>
                        <td className="py-1 px-2 text-right">{c.delivered}</td>
                        <td className="py-1 px-2 text-right">{c.opens}</td>
                        <td className="py-1 px-2 text-right">{c.clicks}</td>
                        <td className="py-1 px-2 text-right">{c.visits_from}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Feature 6: Reactivation template */}
      {reactivation && (
        <Card>
          <SectionHead icon={Send} title="Relance clients inactifs" subtitle={`Template adapté à votre secteur : ${reactivation.sector}`} />
          <div className="p-4 bg-[#F3EFE7] rounded-lg border border-[#E7E5E4]">
            <p className="font-semibold text-[#B85C38] mb-1">{reactivation.template.title}</p>
            <p className="text-sm text-[#1C1917]">{reactivation.template.content}</p>
          </div>
          <p className="text-xs text-[#57534E] mt-3">
            Utilisez ce template dans la page Campaigns pour cibler les clients inactifs de plus de 30 jours.
          </p>
        </Card>
      )}

      {/* Feature 8: Sender name */}
      <Card>
        <SectionHead icon={Zap} title="Nom d'expéditeur des notifications" subtitle="Le nom qui apparaît dans les push et emails" />
        <div className="flex gap-2">
          <input
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Ex: Café Lumière"
            className="flex-1 border border-[#E7E5E4] rounded-lg px-3 py-2 focus:ring-[#B85C38]/20 focus:border-[#B85C38]"
          />
          <button
            onClick={saveSenderName}
            disabled={senderNameSaving}
            className="px-4 py-2 bg-[#B85C38] text-white rounded-lg font-medium hover:bg-[#9C4E2F] disabled:opacity-50"
          >
            {senderNameSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Card>

      {/* Feature 9: Team (manager/staff roles) */}
      <Card>
        <SectionHead icon={Users} title="Équipe" subtitle="Manager = stats uniquement · Staff = scan uniquement" />
        <form onSubmit={addTeamMember} className="flex flex-wrap gap-2 mb-4">
          <input
            type="email"
            required
            placeholder="email@example.com"
            value={addTeamForm.email}
            onChange={(e) => setAddTeamForm({ ...addTeamForm, email: e.target.value })}
            className="flex-1 min-w-[180px] border border-[#E7E5E4] rounded-lg px-3 py-2"
          />
          <input
            type="password"
            required
            placeholder="Mot de passe"
            value={addTeamForm.password}
            onChange={(e) => setAddTeamForm({ ...addTeamForm, password: e.target.value })}
            className="w-40 border border-[#E7E5E4] rounded-lg px-3 py-2"
          />
          <select
            value={addTeamForm.role}
            onChange={(e) => setAddTeamForm({ ...addTeamForm, role: e.target.value })}
            className="border border-[#E7E5E4] rounded-lg px-3 py-2"
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
          </select>
          <button className="px-4 py-2 bg-[#B85C38] text-white rounded-lg font-medium hover:bg-[#9C4E2F] flex items-center gap-2">
            <UserPlus size={16} /> Ajouter
          </button>
        </form>
        {team.length === 0 ? (
          <p className="text-sm text-[#57534E]">Aucun membre d'équipe pour le moment.</p>
        ) : (
          <div className="space-y-1">
            {team.map((m) => (
              <div key={m.email} className="flex items-center justify-between px-3 py-2 bg-[#F3EFE7] rounded">
                <span className="text-sm">{m.email}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-[#B85C38] text-white">{m.role}</span>
                  <button onClick={() => removeTeamMember(m.email)} className="text-red-600 hover:text-red-800">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
