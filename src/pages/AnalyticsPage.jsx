import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  TrendingUp,
  Award,
  Smartphone,
  Gift,
  Calendar,
  Filter,
  MessageSquare,
  Download,
  X,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

const AnalyticsPage = () => {
  // ============ STATE ============
  const [periodFilter, setPeriodFilter] = useState('30d');
  const [customDays, setCustomDays] = useState(null);
  const [newCustomerPeriod, setNewCustomerPeriod] = useState('30d');
  const [newCustomerCustomDays, setNewCustomerCustomDays] = useState(null);
  const [visitThreshold, setVisitThreshold] = useState(5);
  const [activeThreshold, setActiveThreshold] = useState(3);
  const [activeDays, setActiveDays] = useState(30);
  const [inactiveDays, setInactiveDays] = useState(30);
  const [atRiskDays, setAtRiskDays] = useState(21);
  const [frequencyBuckets, setFrequencyBuckets] = useState({
    veryRegular: 3,
    occasional: 14,
  });
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownData, setDrillDownData] = useState(null);

  // ============ DEMO DATA GENERATION ============
  const demoData = useMemo(() => {
    const firstNames = [
      'Marie', 'Pierre', 'Sophie', 'Lucas', 'Emma', 'Jean', 'Anne', 'Michel',
      'Claire', 'Thomas', 'Isabelle', 'Claude', 'Nathalie', 'François', 'Martine',
      'Philippe', 'Véronique', 'Jacques', 'Christine', 'Bernard', 'Monique',
      'Paul', 'Danielle', 'Laurent', 'Sylvie', 'Denis', 'Dominique', 'Olivier',
      'Valérie', 'Alain', 'Florence', 'Marc', 'Corinne', 'Serge', 'Sabine',
    ];

    const lastNames = [
      'Dubois', 'Lambert', 'Martin', 'Bernard', 'Thomas', 'Moreau',
      'Simon', 'Laurent', 'Lefevre', 'Michel', 'Garcia', 'David',
      'Petit', 'Dupont', 'Durand', 'Leroy', 'Henry', 'Renault',
    ];

    const randomDate = (daysAgo) => {
      const d = new Date();
      d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
      return d;
    };

    const tiers = ['Bronze', 'Silver', 'Gold'];
    const getTierFromPoints = (points) => {
      if (points >= 5000) return 'Gold';
      if (points >= 2000) return 'Silver';
      return 'Bronze';
    };

    // Generate 450 demo customers
    const customers = Array.from({ length: 450 }, (_, i) => {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const joinDate = randomDate(365);
      const totalVisits = Math.floor(Math.random() * 80) + 1;
      const lastVisitDate = randomDate(60);
      const points = Math.floor(Math.random() * 8000);
      const walletPass = Math.random() > 0.25;
      const tier = getTierFromPoints(points);
      const spent = Math.floor(Math.random() * 5000) + 500;
      const total_amount_paid = spent;

      return {
        id: i + 1,
        name: `${firstName} ${lastName}`,
        firstName,
        joinDate,
        totalVisits,
        lastVisitDate,
        points,
        walletPass,
        tier,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        spent,
        total_amount_paid,
      };
    });

    // Generate visit history for each customer
    const visits = customers.flatMap((customer) => {
      const visitCount = Math.max(1, Math.floor(customer.totalVisits * (0.8 + Math.random() * 0.4)));
      return Array.from({ length: visitCount }, () => ({
        customerId: customer.id,
        date: randomDate(365),
        spent: Math.floor(Math.random() * 100) + 10,
      }));
    });

    // Generate campaigns (sent last 90 days)
    const campaigns = [
      {
        id: 1,
        name: 'Easter Promo 2026',
        date: new Date('2026-04-03'),
        sentCount: 380,
        visitsAfter: 142,
      },
      {
        id: 2,
        name: 'Spring Collection Launch',
        date: new Date('2026-03-20'),
        sentCount: 415,
        visitsAfter: 178,
      },
      {
        id: 3,
        name: 'Gold Tier Exclusive',
        date: new Date('2026-04-10'),
        sentCount: 95,
        visitsAfter: 38,
      },
      {
        id: 4,
        name: 'Weekend Flash Sale',
        date: new Date('2026-04-12'),
        sentCount: 450,
        visitsAfter: 203,
      },
    ];

    return { customers, visits, campaigns };
  }, []);

  // ============ COMPUTED VALUES ============
  const getPeriodDays = (period, customDaysValue) => {
    if (period === 'custom' && customDaysValue) return parseInt(customDaysValue);
    const map = { '7d': 7, '14d': 14, '30d': 30, '60d': 60, '90d': 90 };
    return map[period] || 30;
  };

  const periodDays = getPeriodDays(periodFilter, customDays);
  const newCustomerDays = getPeriodDays(newCustomerPeriod, newCustomerCustomDays);

  const totalCustomers = demoData.customers.length;

  const newCustomersInPeriod = demoData.customers.filter((c) => {
    const daysSinceJoin = Math.floor(
      (new Date() - c.joinDate) / (1000 * 60 * 60 * 24)
    );
    return daysSinceJoin <= newCustomerDays;
  }).length;

  const repeatVisitRate = useMemo(() => {
    const inPeriod = demoData.customers.filter((c) => {
      const daysSinceLastVisit = Math.floor(
        (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
      );
      return daysSinceLastVisit <= periodDays;
    });
    const repeatCount = inPeriod.filter((c) => c.totalVisits >= visitThreshold).length;
    return inPeriod.length > 0 ? Math.round((repeatCount / inPeriod.length) * 100) : 0;
  }, [periodDays, visitThreshold]);

  const walletPassCustomers = demoData.customers.filter((c) => c.walletPass).length;
  const walletPassPercentage = Math.round((walletPassCustomers / totalCustomers) * 100);

  const avgPointsPerCustomer = Math.round(
    demoData.customers.reduce((sum, c) => sum + c.points, 0) / totalCustomers
  );

  // Issue 7: Fix redemption rate to be calculated, not random
  const redemptionRate = useMemo(() => {
    const customersWithRedemption = demoData.customers.filter((c) => c.totalVisits >= 10).length;
    return Math.round((customersWithRedemption / totalCustomers) * 100);
  }, [totalCustomers]);

  // Issue 11: Calculate total revenue from customer data
  const totalRevenue = useMemo(() => {
    return demoData.customers.reduce((sum, c) => sum + c.total_amount_paid, 0);
  }, [demoData.customers]);

  // Issue 12: Calculate average visit value
  const totalVisits = useMemo(() => {
    return demoData.visits.length;
  }, [demoData.visits]);

  const averageVisitValue = useMemo(() => {
    return totalVisits > 0 ? (totalRevenue / totalVisits).toFixed(2) : 0;
  }, [totalRevenue, totalVisits]);

  const activeCustomers = demoData.customers.filter((c) => {
    const daysSinceLastVisit = Math.floor(
      (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
    );
    return daysSinceLastVisit <= activeDays && c.totalVisits >= activeThreshold;
  }).length;

  const inactiveCustomers = demoData.customers.filter((c) => {
    const daysSinceLastVisit = Math.floor(
      (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
    );
    return daysSinceLastVisit > inactiveDays;
  }).length;

  const atRiskCustomers = demoData.customers
    .filter((c) => {
      const daysSinceLastVisit = Math.floor(
        (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
      );
      return daysSinceLastVisit > atRiskDays && daysSinceLastVisit <= atRiskDays + 30;
    })
    .map((c) => ({
      ...c,
      daysSinceLastVisit: Math.floor(
        (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
      ),
    }))
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);

  const tierCounts = {
    Bronze: demoData.customers.filter((c) => c.tier === 'Bronze').length,
    Silver: demoData.customers.filter((c) => c.tier === 'Silver').length,
    Gold: demoData.customers.filter((c) => c.tier === 'Gold').length,
  };

  const tierMovement = {
    upgraded: Math.floor(Math.random() * 35) + 8,
    downgraded: Math.floor(Math.random() * 12) + 2,
  };

  const frequencyData = [
    {
      label: `Very Regular (every ${frequencyBuckets.veryRegular} days or less)`,
      count: demoData.customers.filter((c) => {
        const avgDaysBetweenVisits =
          (new Date() - c.joinDate) / (1000 * 60 * 60 * 24) / c.totalVisits;
        return avgDaysBetweenVisits <= frequencyBuckets.veryRegular;
      }).length,
    },
    {
      label: `Occasional (${frequencyBuckets.veryRegular + 1}–${frequencyBuckets.occasional} days)`,
      count: demoData.customers.filter((c) => {
        const avgDaysBetweenVisits =
          (new Date() - c.joinDate) / (1000 * 60 * 60 * 24) / c.totalVisits;
        return (
          avgDaysBetweenVisits > frequencyBuckets.veryRegular &&
          avgDaysBetweenVisits <= frequencyBuckets.occasional
        );
      }).length,
    },
    {
      label: `Rare (more than ${frequencyBuckets.occasional} days)`,
      count: demoData.customers.filter((c) => {
        const avgDaysBetweenVisits =
          (new Date() - c.joinDate) / (1000 * 60 * 60 * 24) / c.totalVisits;
        return avgDaysBetweenVisits > frequencyBuckets.occasional;
      }).length,
    },
  ];

  const visitFrequencyChartData = frequencyData.map((item) => ({
    name: item.label,
    value: item.count,
  }));

  // ============ CHART DATA ============
  const visitsOverTimeData = useMemo(() => {
    const days = Array.from({ length: periodDays }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (periodDays - 1 - i));
      return d.toISOString().split('T')[0];
    });

    const visitMap = {};
    days.forEach((day) => {
      visitMap[day] = 0;
    });

    demoData.visits.forEach((visit) => {
      const day = visit.date.toISOString().split('T')[0];
      if (visitMap.hasOwnProperty(day)) {
        visitMap[day]++;
      }
    });

    return days.map((day) => ({
      date: day,
      visits: visitMap[day],
      customers: demoData.customers.filter((c) =>
        demoData.visits.some(v => v.customerId === c.id && v.date.toISOString().split('T')[0] === day)
      ),
    }));
  }, [periodDays, demoData.visits, demoData.customers]);

  const newCustomersOverTimeData = useMemo(() => {
    const weeks = Array.from({ length: Math.ceil(periodDays / 7) }, (_, i) => {
      const start = new Date();
      start.setDate(start.getDate() - (periodDays - 1 - i * 7));
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    });

    let cumulativeNew = 0;
    return weeks.map((week) => {
      const newInWeek = demoData.customers.filter((c) => {
        const joinDay = c.joinDate.toISOString().split('T')[0];
        return joinDay >= week.start && joinDay <= week.end;
      });
      cumulativeNew += newInWeek.length;
      return {
        week: week.start.substring(5),
        new: newInWeek.length,
        cumulative: cumulativeNew,
        customers: newInWeek,
      };
    });
  }, [periodDays, demoData.customers]);

  const tierChartData = [
    { name: 'Bronze', value: tierCounts.Bronze, fill: '#8B6914' },
    { name: 'Silver', value: tierCounts.Silver, fill: '#C0C0C0' },
    { name: 'Gold', value: tierCounts.Gold, fill: '#E3A869' },
  ];

  const visitRecencyData = [
    {
      range: '0–7 days',
      count: demoData.customers.filter((c) => {
        const d = Math.floor((new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24));
        return d <= 7;
      }).length,
    },
    {
      range: '8–14 days',
      count: demoData.customers.filter((c) => {
        const d = Math.floor((new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24));
        return d > 7 && d <= 14;
      }).length,
    },
    {
      range: '15–30 days',
      count: demoData.customers.filter((c) => {
        const d = Math.floor((new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24));
        return d > 14 && d <= 30;
      }).length,
    },
    {
      range: '31–60 days',
      count: demoData.customers.filter((c) => {
        const d = Math.floor((new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24));
        return d > 30 && d <= 60;
      }).length,
    },
    {
      range: '60+ days',
      count: demoData.customers.filter((c) => {
        const d = Math.floor((new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24));
        return d > 60;
      }).length,
    },
  ];

  const heatmapData = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const times = ['Morning (6–11am)', 'Afternoon (12–5pm)', 'Evening (6–11pm)'];
    const matrix = [];

    days.forEach((day, dayIdx) => {
      times.forEach((time, timeIdx) => {
        const visitorsAtTime = demoData.visits.filter((v) => {
          const dayOfWeek = v.date.getDay();
          const hour = v.date.getHours();
          const matchDay = (dayOfWeek + 6) % 7 === dayIdx;
          const matchTime =
            (timeIdx === 0 && hour >= 6 && hour < 12) ||
            (timeIdx === 1 && hour >= 12 && hour < 17) ||
            (timeIdx === 2 && hour >= 17 && hour < 24);
          return matchDay && matchTime;
        });

        const visits = visitorsAtTime.length;
        const customers = Array.from(new Set(visitorsAtTime.map(v => v.customerId)))
          .map(id => demoData.customers.find(c => c.id === id))
          .filter(Boolean);

        matrix.push({
          day,
          time,
          visits,
          customers,
          intensity: visits > 30 ? 'high' : visits > 15 ? 'medium' : 'low',
        });
      });
    });

    return matrix;
  }, [demoData.visits, demoData.customers]);

  // ============ PERIOD LABEL ============
  const getPeriodLabel = (period, customDaysValue) => {
    if (period === 'custom' && customDaysValue) return `last ${customDaysValue} days`;
    const map = {
      '7d': 'last 7 days',
      '14d': 'last 14 days',
      '30d': 'last 30 days',
      '60d': 'last 60 days',
      '90d': 'last 90 days',
    };
    return map[period] || 'last 30 days';
  };

  // ============ DRILL DOWN HANDLER ============
  const openDrillDown = (title, customers) => {
    setDrillDownData({ title, customers });
    setDrillDownOpen(true);
  };

  // ============ CSV EXPORT ============
  const exportCSV = (customers) => {
    if (!customers || customers.length === 0) {
      alert('No customers to export');
      return;
    }

    const headers = ['ID', 'Name', 'Email', 'Total Visits', 'Last Visit', 'Points', 'Tier', 'Wallet Pass'];
    const rows = customers.map((c) => [
      c.id,
      c.name,
      c.email,
      c.totalVisits,
      c.lastVisitDate.toLocaleDateString(),
      c.points,
      c.tier,
      c.walletPass ? 'Yes' : 'No',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `customers-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ============ COMPONENTS ============
  const PeriodSelector = ({ value, customValue, onChange, onCustomChange, label }) => (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm text-[#57534E]">{label}</span>}
      <div className="flex gap-2">
        {['7d', '14d', '30d', '60d', '90d'].map((period) => (
          <button
            key={period}
            onClick={() => onChange(period)}
            className={`px-3 py-1 text-sm rounded transition ${
              value === period
                ? 'bg-[#B85C38] text-[#FDFBF7]'
                : 'bg-[#E7E5E4] text-[#57534E] hover:bg-[#D3D1D0]'
            }`}
          >
            {period}
          </button>
        ))}
        <div className="flex gap-1">
          <input
            type="number"
            placeholder="Days"
            value={customValue || ''}
            onChange={(e) => {
              onCustomChange(e.target.value);
              onChange('custom');
            }}
            className="w-16 px-2 py-1 text-sm border border-[#E7E5E4] rounded"
          />
          {customValue && (
            <button
              onClick={() => onChange('custom')}
              className={`px-3 py-1 text-sm rounded transition ${
                value === 'custom'
                  ? 'bg-[#B85C38] text-[#FDFBF7]'
                  : 'bg-[#E7E5E4] text-[#57534E] hover:bg-[#D3D1D0]'
              }`}
            >
              custom
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const KPICard = ({ icon: Icon, title, value, label, subtitle, onClick, action }) => (
    <div
      onClick={onClick}
      className="bg-[#FDFBF7] border border-[#E7E5E4] rounded-lg p-6 hover:shadow-md transition cursor-pointer"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-[#F3EFE7] rounded">
          <Icon className="w-5 h-5 text-[#B85C38]" />
        </div>
        <h3 className="font-cormorant text-lg font-semibold text-[#1C1917]">{title}</h3>
      </div>
      <div className="text-3xl font-bold text-[#1C1917] mb-2">{value}</div>
      <p className="text-sm text-[#57534E] mb-2">{label}</p>
      {subtitle && <p className="text-xs text-[#8B8680]">{subtitle}</p>}
      {action && <button className="mt-3 text-xs bg-[#B85C38] text-[#FDFBF7] px-3 py-1 rounded hover:bg-[#A24D2E] transition">{action}</button>}
    </div>
  );

  const SectionHeader = ({ title, description }) => (
    <div className="mb-6">
      <h2 className="font-cormorant text-3xl font-bold text-[#1C1917] mb-1">{title}</h2>
      {description && <p className="text-sm text-[#8B8680]">{description}</p>}
    </div>
  );

  const ChartContainer = ({ children, title, description }) => (
    <div className="bg-[#FDFBF7] border border-[#E7E5E4] rounded-lg p-6 mb-8">
      <div className="mb-6">
        <h3 className="font-cormorant text-2xl font-semibold text-[#1C1917] mb-1">{title}</h3>
        {description && <p className="text-sm text-[#8B8680]">{description}</p>}
      </div>
      {children}
    </div>
  );

  // ============ RENDER ============
  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-cormorant text-4xl font-bold text-[#1C1917] mb-2">
            Your Loyalty Programme
          </h1>
          <p className="text-[#57534E]">
            See how your customers are engaging with FidéliTour
          </p>
        </div>

        {/* Section 1: Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-12">
          <KPICard
            icon={Users}
            title="Total Customers"
            value={totalCustomers.toLocaleString()}
            label="People who have joined your loyalty programme"
            onClick={() =>
              openDrillDown('All Customers', demoData.customers)
            }
          />

          <KPICard
            icon={TrendingUp}
            title="New Customers"
            value={newCustomersInPeriod}
            label={`New people who signed up in the ${getPeriodLabel(newCustomerPeriod, newCustomerCustomDays)}`}
            subtitle={<PeriodSelector
              value={newCustomerPeriod}
              customValue={newCustomerCustomDays}
              onChange={setNewCustomerPeriod}
              onCustomChange={setNewCustomerCustomDays}
            />}
            onClick={() => {
              const newCustomersInRange = demoData.customers.filter((c) => {
                const daysSinceJoin = Math.floor(
                  (new Date() - c.joinDate) / (1000 * 60 * 60 * 24)
                );
                return daysSinceJoin <= newCustomerDays;
              });
              openDrillDown('New Customers', newCustomersInRange);
            }}
          />

          <KPICard
            icon={Award}
            title="Repeat Visit Rate"
            value={`${repeatVisitRate}%`}
            label={`Out of everyone who visited, how many came back at least ${visitThreshold} times — your most loyal regulars`}
            subtitle={
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#8B8680]">Visit threshold:</label>
                <input
                  type="number"
                  min="2"
                  value={visitThreshold}
                  onChange={(e) => setVisitThreshold(parseInt(e.target.value) || 5)}
                  className="w-12 px-1 py-1 border border-[#E7E5E4] rounded text-xs"
                />
              </div>
            }
            onClick={() => {
              const repeaters = demoData.customers.filter(
                (c) =>
                  c.totalVisits >= visitThreshold &&
                  Math.floor((new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)) <=
                    periodDays
              );
              openDrillDown(`Customers with ${visitThreshold}+ visits`, repeaters);
            }}
          />

          <KPICard
            icon={Gift}
            title="Average Points Per Customer"
            value={avgPointsPerCustomer.toLocaleString()}
            label="How many reward points each customer has earned"
            subtitle={`Redemption rate: ${redemptionRate}%`}
          />

          <KPICard
            icon={Calendar}
            title="Total Revenue"
            value={`€${(totalRevenue / 1000).toFixed(0)}K`}
            label="Sum of all customer spending"
          />

          <KPICard
            icon={TrendingUp}
            title="Average Visit Value"
            value={`€${averageVisitValue}`}
            label="Total revenue divided by visits"
          />
        </div>

        {/* Section 2: Visits Over Time */}
        <ChartContainer
          title="Visits Over Time"
          description="Watch how foot traffic changes. The vertical lines show when you sent a campaign."
        >
          <PeriodSelector
            value={periodFilter}
            customValue={customDays}
            onChange={setPeriodFilter}
            onCustomChange={setCustomDays}
            label="Period:"
          />
          <div className="mt-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={visitsOverTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="date" stroke="#8B8680" label={{ value: 'Date', position: 'insideBottomRight', offset: -5 }} />
                <YAxis stroke="#8B8680" label={{ value: 'Number of Visits', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FDFBF7',
                    border: '1px solid #E7E5E4',
                  }}
                />
                {demoData.campaigns.map((campaign) => {
                  const campaignDate = campaign.date.toISOString().split('T')[0];
                  return (
                    <line
                      key={campaign.id}
                      x1={`${(visitsOverTimeData.findIndex((d) => d.date === campaignDate) / visitsOverTimeData.length) * 100}%`}
                      y1="0"
                      x2={`${(visitsOverTimeData.findIndex((d) => d.date === campaignDate) / visitsOverTimeData.length) * 100}%`}
                      y2="100%"
                      stroke="#B85C38"
                      strokeDasharray="5 5"
                      opacity="0.5"
                    />
                  );
                })}
                <Line
                  type="monotone"
                  dataKey="visits"
                  stroke="#B85C38"
                  dot={{ fill: '#B85C38', r: 4, cursor: 'pointer' }}
                  strokeWidth={2}
                  onClick={(state) => {
                    if (state.payload && state.payload.customers) {
                      openDrillDown(`Visitors on ${state.payload.date}`, state.payload.customers);
                    }
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        {/* Section 3: New Customers Over Time */}
        <ChartContainer
          title="New Customers Over Time"
          description="See how fast your programme is growing."
        >
          <PeriodSelector
            value={periodFilter}
            customValue={customDays}
            onChange={setPeriodFilter}
            onCustomChange={setCustomDays}
            label="Period:"
          />
          <div className="mt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={newCustomersOverTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="week" stroke="#8B8680" label={{ value: 'Week Starting', position: 'insideBottomRight', offset: -5 }} />
                <YAxis stroke="#8B8680" label={{ value: 'New Signups', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FDFBF7',
                    border: '1px solid #E7E5E4',
                  }}
                />
                <Legend />
                <Bar dataKey="new" fill="#2D7D9A" name="New this week" onClick={(state) => {
                  if (state.payload && state.payload.customers) {
                    openDrillDown(`New Customers: Week of ${state.payload.week}`, state.payload.customers);
                  }
                }} cursor="pointer" />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#E3A869"
                  name="Cumulative"
                  strokeWidth={2}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>

        {/* Section 4: Tier Distribution */}
        <ChartContainer
          title="Tier Distribution"
          description="How many customers are at each tier level."
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={tierChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value} (${Math.round((value / totalCustomers) * 100)}%)`}
                  >
                    {tierChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FDFBF7',
                      border: '1px solid #E7E5E4',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="lg:col-span-2 space-y-4">
              {tierChartData.map((tier) => (
                <div
                  key={tier.name}
                  onClick={() => {
                    const tierCustomers = demoData.customers.filter(
                      (c) => c.tier === tier.name
                    );
                    openDrillDown(`${tier.name} Customers`, tierCustomers);
                  }}
                  className="p-4 bg-[#F3EFE7] rounded border border-[#E7E5E4] cursor-pointer hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: tier.fill }}
                    />
                    <h4 className="font-cormorant text-lg font-semibold text-[#1C1917]">
                      {tier.name}
                    </h4>
                    <span className="text-sm text-[#57534E]">
                      {tier.value} customers (
                      {Math.round((tier.value / totalCustomers) * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
              <div className="p-4 bg-[#F3EFE7] rounded border border-[#E7E5E4]">
                <h4 className="font-cormorant text-lg font-semibold text-[#1C1917] mb-3">
                  Tier Movement This Month
                </h4>
                <div className="flex gap-6">
                  <div>
                    <p className="text-sm text-[#57534E]">Upgraded</p>
                    <p className="text-2xl font-bold text-[#4A5D23]">
                      ↑ {tierMovement.upgraded}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[#57534E]">Downgraded</p>
                    <p className="text-2xl font-bold text-red-600">
                      ↓ {tierMovement.downgraded}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ChartContainer>

        {/* Section 5: Active vs Inactive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          <div
            onClick={() => {
              const active = demoData.customers.filter((c) => {
                const daysSinceLastVisit = Math.floor(
                  (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
                );
                return daysSinceLastVisit <= activeDays && c.totalVisits >= activeThreshold;
              });
              openDrillDown('Active Customers', active);
            }}
            className="bg-[#FDFBF7] border border-[#E7E5E4] rounded-lg p-6 cursor-pointer hover:shadow-md transition"
          >
            <h3 className="font-cormorant text-2xl font-semibold text-[#1C1917] mb-4">
              Active Customers
            </h3>
            <div className="text-4xl font-bold text-[#4A5D23] mb-4">{activeCustomers}</div>
            <p className="text-sm text-[#57534E] mb-4">
              Customers who visited at least{' '}
              <input
                type="number"
                min="1"
                value={activeThreshold}
                onChange={(e) => setActiveThreshold(parseInt(e.target.value) || 1)}
                className="w-10 px-1 py-0 border border-[#E7E5E4] rounded text-sm"
              />{' '}
              times in the last{' '}
              <input
                type="number"
                min="1"
                value={activeDays}
                onChange={(e) => setActiveDays(parseInt(e.target.value) || 30)}
                className="w-12 px-1 py-0 border border-[#E7E5E4] rounded text-sm"
              />{' '}
              days
            </p>
            <p className="text-xs text-[#8B8680]">
              These are your regular, engaged customers
            </p>
          </div>

          <div
            onClick={() => {
              const inactive = demoData.customers.filter((c) => {
                const daysSinceLastVisit = Math.floor(
                  (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
                );
                return daysSinceLastVisit > inactiveDays;
              });
              openDrillDown('Inactive Customers', inactive);
            }}
            className="bg-[#FDFBF7] border border-[#E7E5E4] rounded-lg p-6 cursor-pointer hover:shadow-md transition"
          >
            <h3 className="font-cormorant text-2xl font-semibold text-[#1C1917] mb-4">
              Inactive Customers
            </h3>
            <div className="text-4xl font-bold text-red-600 mb-4">{inactiveCustomers}</div>
            <p className="text-sm text-[#57534E] mb-4">
              Customers who haven't visited in more than{' '}
              <input
                type="number"
                min="1"
                value={inactiveDays}
                onChange={(e) => setInactiveDays(parseInt(e.target.value) || 30)}
                className="w-12 px-1 py-0 border border-[#E7E5E4] rounded text-sm"
              />{' '}
              days
            </p>
            <p className="text-xs text-[#8B8680]">
              These customers have gone dormant — try to win them back
            </p>
            <button className="mt-4 text-sm bg-[#B85C38] text-[#FDFBF7] px-4 py-2 rounded hover:bg-[#A24D2E] transition">
              Send message to inactive customers
            </button>
          </div>
        </div>

        {/* Section 6: Visit Frequency Breakdown */}
        <ChartContainer
          title="Visit Frequency Breakdown"
          description="How often do your customers typically come in?"
        >
          <div className="mb-6 space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <label>Very Regular: every</label>
              <input
                type="number"
                min="1"
                value={frequencyBuckets.veryRegular}
                onChange={(e) =>
                  setFrequencyBuckets({
                    ...frequencyBuckets,
                    veryRegular: parseInt(e.target.value) || 3,
                  })
                }
                className="w-12 px-2 py-1 border border-[#E7E5E4] rounded"
              />
              <span>days or less</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label>Occasional: between {frequencyBuckets.veryRegular + 1} and</label>
              <input
                type="number"
                min={frequencyBuckets.veryRegular + 1}
                value={frequencyBuckets.occasional}
                onChange={(e) =>
                  setFrequencyBuckets({
                    ...frequencyBuckets,
                    occasional: parseInt(e.target.value) || 14,
                  })
                }
                className="w-12 px-2 py-1 border border-[#E7E5E4] rounded"
              />
              <span>days</span>
            </div>
            <div className="text-sm text-[#57534E]">
              Rare: more than {frequencyBuckets.occasional} days
            </div>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={visitFrequencyChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis type="number" stroke="#8B8680" label={{ value: 'Number of Customers', position: 'insideBottomRight', offset: -5 }} />
              <YAxis dataKey="name" type="category" width={200} stroke="#8B8680" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FDFBF7',
                  border: '1px solid #E7E5E4',
                }}
              />
              <Bar dataKey="value" fill="#8B6914" onClick={(state) => {
                const label = state.payload.name;
                const customers = visitFrequencyChartData.find(d => d.name === label)
                  ? demoData.customers.filter((c) => {
                    const avgDaysBetweenVisits = (new Date() - c.joinDate) / (1000 * 60 * 60 * 24) / c.totalVisits;
                    if (label.includes('Very Regular')) return avgDaysBetweenVisits <= frequencyBuckets.veryRegular;
                    if (label.includes('Occasional')) return avgDaysBetweenVisits > frequencyBuckets.veryRegular && avgDaysBetweenVisits <= frequencyBuckets.occasional;
                    if (label.includes('Rare')) return avgDaysBetweenVisits > frequencyBuckets.occasional;
                    return false;
                  })
                  : [];
                openDrillDown(label, customers);
              }} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Section 7: At-Risk Customers */}
        <ChartContainer
          title="Customers you might be about to lose"
          description="These people haven't visited in a while. Send them a message to bring them back."
        >
          <div className="mb-6 flex items-center gap-3">
            <label className="text-sm text-[#57534E]">Haven't visited in more than</label>
            <input
              type="number"
              min="1"
              value={atRiskDays}
              onChange={(e) => setAtRiskDays(parseInt(e.target.value) || 21)}
              className="w-16 px-2 py-1 border border-[#E7E5E4] rounded"
            />
            <span className="text-sm text-[#57534E]">days</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E7E5E4]">
                  <th className="text-left py-3 px-4 text-[#57534E]">Name</th>
                  <th className="text-left py-3 px-4 text-[#57534E]">Last Visit</th>
                  <th className="text-left py-3 px-4 text-[#57534E]">Days Ago</th>
                  <th className="text-left py-3 px-4 text-[#57534E]">Total Visits</th>
                  <th className="text-left py-3 px-4 text-[#57534E]">Tier</th>
                  <th className="text-left py-3 px-4 text-[#57534E]">Action</th>
                </tr>
              </thead>
              <tbody>
                {atRiskCustomers.slice(0, 10).map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-[#E7E5E4] hover:bg-[#F3EFE7]"
                  >
                    <td className="py-3 px-4">{customer.firstName}</td>
                    <td className="py-3 px-4 text-[#8B8680]">
                      {customer.lastVisitDate.toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-red-600">
                      {customer.daysSinceLastVisit}
                    </td>
                    <td className="py-3 px-4">{customer.totalVisits}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold text-white ${
                          customer.tier === 'Gold'
                            ? 'bg-[#E3A869]'
                            : customer.tier === 'Silver'
                            ? 'bg-gray-400'
                            : 'bg-amber-600'
                        }`}
                      >
                        {customer.tier}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button className="text-[#B85C38] hover:underline text-xs font-semibold">
                        Send message
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {atRiskCustomers.length > 10 && (
            <div className="mt-4 text-center text-sm text-[#57534E]">
              Showing 10 of {atRiskCustomers.length} at-risk customers
            </div>
          )}

          <button className="mt-6 w-full bg-[#B85C38] text-[#FDFBF7] py-2 rounded hover:bg-[#A24D2E] transition font-semibold">
            Send win-back campaign to selected
          </button>
        </ChartContainer>

        {/* Section 8: Campaign Performance */}
        <ChartContainer
          title="Did your messages actually bring people in?"
          description="See which campaigns drove the most visits."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E7E5E4]">
                  <th className="text-left py-3 px-4 text-[#57534E]">Campaign</th>
                  <th className="text-left py-3 px-4 text-[#57534E]">Date Sent</th>
                  <th className="text-left py-3 px-4 text-[#57534E]">Sent To</th>
                  <th className="text-left py-3 px-4 text-[#57534E]">Visits After</th>
                  <th className="text-left py-3 px-4 text-[#57534E]">Uplift</th>
                </tr>
              </thead>
              <tbody>
                {demoData.campaigns.map((campaign) => {
                  const uplift = Math.round(
                    ((campaign.visitsAfter / campaign.sentCount) * 100 - 25) * 10
                  ) / 10;
                  return (
                    <tr
                      key={campaign.id}
                      onClick={() => {
                        const visitorsAfterCampaign = demoData.customers.filter((c) => {
                          const visitAfterCampaign = demoData.visits.some(
                            (v) => v.customerId === c.id && v.date > campaign.date
                          );
                          return visitAfterCampaign;
                        });
                        openDrillDown(
                          `Customers who visited after "${campaign.name}"`,
                          visitorsAfterCampaign
                        );
                      }}
                      className="border-b border-[#E7E5E4] hover:bg-[#F3EFE7] cursor-pointer"
                    >
                      <td className="py-3 px-4 font-semibold">{campaign.name}</td>
                      <td className="py-3 px-4 text-[#8B8680]">
                        {campaign.date.toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">{campaign.sentCount}</td>
                      <td className="py-3 px-4 font-semibold text-[#4A5D23]">
                        {campaign.visitsAfter}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-sm font-semibold ${
                            uplift > 0 ? 'text-[#4A5D23]' : 'text-red-600'
                          }`}
                        >
                          {uplift > 0 ? '+' : ''}{uplift}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartContainer>

        {/* Section 9: Best Days & Times */}
        <ChartContainer
          title="When do your customers usually come in?"
          description="Use this to decide when to send messages for maximum impact."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F3EFE7]">
                  <th className="text-left py-3 px-4 text-[#57534E]">Time</th>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <th key={day} className="text-center py-3 px-4 text-[#57534E]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['Morning (6–11am)', 'Afternoon (12–5pm)', 'Evening (6–11pm)'].map((time) => (
                  <tr key={time} className="border-b border-[#E7E5E4]">
                    <td className="py-3 px-4 font-semibold text-[#57534E]">{time}</td>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                      const cell = heatmapData.find((h) => h.day === day && h.time === time);
                      const intensity = cell?.intensity || 'low';
                      const bgColor =
                        intensity === 'high'
                          ? 'bg-[#B85C38]'
                          : intensity === 'medium'
                          ? 'bg-[#E3A869]'
                          : 'bg-[#E7E5E4]';
                      const textColor =
                        intensity === 'high'
                          ? 'text-[#FDFBF7]'
                          : 'text-[#57534E]';
                      return (
                        <td
                          key={day}
                          className={`text-center py-3 px-4 ${bgColor} ${textColor} font-semibold cursor-pointer hover:opacity-80 transition`}
                          onClick={() => {
                            if (cell && cell.customers && cell.customers.length > 0) {
                              openDrillDown(`Customers: ${day} ${time}`, cell.customers);
                            }
                          }}
                        >
                          {cell?.visits || 0}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#8B8680] mt-4">
            Darker = more visits. Light colors mean fewer people visit at that time. Click a cell to see customers.
          </p>
        </ChartContainer>

        {/* Section 10: Days Since Last Visit */}
        <ChartContainer
          title="How long ago did each customer last visit?"
          description="See the distribution of recency — how fresh are your relationships?"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={visitRecencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis dataKey="range" stroke="#8B8680" label={{ value: 'Recency Range', position: 'insideBottomRight', offset: -5 }} />
              <YAxis stroke="#8B8680" label={{ value: 'Customers', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FDFBF7',
                  border: '1px solid #E7E5E4',
                }}
              />
              <Bar
                dataKey="count"
                fill="#4A5D23"
                onClick={(state) => {
                  const rangeMap = {
                    '0–7 days': (c) => {
                      const d = Math.floor(
                        (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
                      );
                      return d <= 7;
                    },
                    '8–14 days': (c) => {
                      const d = Math.floor(
                        (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
                      );
                      return d > 7 && d <= 14;
                    },
                    '15–30 days': (c) => {
                      const d = Math.floor(
                        (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
                      );
                      return d > 14 && d <= 30;
                    },
                    '31–60 days': (c) => {
                      const d = Math.floor(
                        (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
                      );
                      return d > 30 && d <= 60;
                    },
                    '60+ days': (c) => {
                      const d = Math.floor(
                        (new Date() - c.lastVisitDate) / (1000 * 60 * 60 * 24)
                      );
                      return d > 60;
                    },
                  };
                  const customers = demoData.customers.filter(
                    rangeMap[state.payload.range]
                  );
                  openDrillDown(
                    `Customers: last visit ${state.payload.range}`,
                    customers
                  );
                }}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Customer Drill-Down Panel */}
      {drillDownOpen && drillDownData && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setDrillDownOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-[#FDFBF7] shadow-lg overflow-y-auto z-50"
          >
            {/* Header */}
            <div className="sticky top-0 border-b border-[#E7E5E4] p-6 bg-[#FDFBF7]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-cormorant text-2xl font-bold text-[#1C1917]">
                    {drillDownData.title}
                  </h2>
                  <p className="text-sm text-[#8B8680]">
                    {drillDownData.customers.length} customers
                  </p>
                </div>
                <button
                  onClick={() => setDrillDownOpen(false)}
                  className="p-2 hover:bg-[#E7E5E4] rounded transition"
                >
                  <X className="w-5 h-5 text-[#1C1917]" />
                </button>
              </div>
            </div>

            {/* Customer List */}
            <div className="p-6 space-y-4">
              {drillDownData.customers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#8B8680]">No customers to display</p>
                </div>
              ) : (
                drillDownData.customers.map((customer) => {
                  const daysSinceLastVisit = Math.floor(
                    (new Date() - customer.lastVisitDate) / (1000 * 60 * 60 * 24)
                  );
                  const lastVisitLabel =
                    daysSinceLastVisit === 0
                      ? 'Today'
                      : daysSinceLastVisit === 1
                      ? 'Yesterday'
                      : `${daysSinceLastVisit} days ago`;

                  return (
                    <div
                      key={customer.id}
                      className="border border-[#E7E5E4] rounded p-4 hover:bg-[#F3EFE7] transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#B85C38] text-[#FDFBF7] flex items-center justify-center font-semibold text-sm">
                            {customer.firstName[0]}{customer.firstName[1] || ''}
                          </div>
                          <div>
                            <p className="font-semibold text-[#1C1917]">
                              {customer.name}
                            </p>
                            <p className="text-xs text-[#8B8680]">{customer.email}</p>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded text-white ${
                            customer.tier === 'Gold'
                              ? 'bg-[#E3A869]'
                              : customer.tier === 'Silver'
                              ? 'bg-gray-400'
                              : 'bg-amber-600'
                          }`}
                        >
                          {customer.tier}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <p className="text-[#8B8680]">Total Visits</p>
                          <p className="font-semibold text-[#1C1917]">
                            {customer.totalVisits}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#8B8680]">Last Visit</p>
                          <p className="font-semibold text-[#1C1917]">
                            {lastVisitLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#8B8680]">Points</p>
                          <p className="font-semibold text-[#B85C38]">
                            {customer.points.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#8B8680]">Wallet Pass</p>
                          <p className="font-semibold text-[#1C1917]">
                            {customer.walletPass ? 'Yes' : 'No'}
                          </p>
                        </div>
                      </div>

                      <button className="w-full text-sm bg-[#B85C38] text-[#FDFBF7] py-2 rounded hover:bg-[#A24D2E] transition font-semibold">
                        Send message
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {drillDownData.customers.length > 0 && (
              <div className="sticky bottom-0 border-t border-[#E7E5E4] p-6 bg-[#FDFBF7] space-y-3">
                <button
                  onClick={() => exportCSV(drillDownData.customers)}
                  className="w-full text-sm bg-[#E7E5E4] text-[#1C1917] py-2 rounded hover:bg-[#D3D1D0] transition font-semibold flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export as CSV
                </button>
                <button className="w-full text-sm bg-[#B85C38] text-[#FDFBF7] py-2 rounded hover:bg-[#A24D2E] transition font-semibold flex items-center justify-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Create campaign for this group
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
