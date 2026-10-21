import React, { useState, useEffect, useMemo } from 'react';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6KEL942_rjkd9FDbqpfV69RN5b_It9nLZBBBGSriCbJJcB46y9dXuhZaXfHJOAyV3/exec";

// Targets
const MONTHLY_TARGET = 1600000; // ₱1.6M
const YEARLY_TARGET = MONTHLY_TARGET * 12; // ₱19.2M

interface LoanRow {
  "Loan ID"?: string;
  "Name"?: string;
  "Division"?: string;
  "Loan Date"?: string;
  "Posted Date"?: string;
  "Principal Amount"?: number | string;
  "Total Loan"?: number | string;
  "Net Proceeds"?: number | string;
  "Purpose"?: string;
  "Loan Type"?: string;
  [key: string]: any;
}

export default function App() {
  const [loanData, setLoanData] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLoanType, setSelectedLoanType] = useState<string>('All');
  const [selectedPurpose, setSelectedPurpose] = useState<string>('All');
  const [selectedDivision, setSelectedDivision] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('All');
  
  // Date Range States
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL);
      if (!response.ok) throw new Error("Failed to fetch data");
      const data: LoanRow[] = await response.json();
      setLoanData(data);
    } catch (err) {
      console.error(err);
      setError("Hindi ma-load ang data mula sa Google Sheet. Siguraduhing na-deploy nang tama.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper: STRICTLY Posted Date ONLY
  const getPostedDate = (row: LoanRow): Date | null => {
    const rawDateStr = String(row["Posted Date"] || '');
    if (!rawDateStr) return null;
    const d = new Date(rawDateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Filtered Computation for Table & Cards
  const filteredLoans = useMemo(() => {
    return loanData.filter(row => {
      const matchesSearch = 
        (row["Name"] && String(row["Name"]).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (row["Division"] && String(row["Division"]).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (row["Purpose"] && String(row["Purpose"]).toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesLoanType = selectedLoanType === 'All' || 
        (row["Loan Type"] && String(row["Loan Type"]) === selectedLoanType) ||
        (!row["Loan Type"] && selectedLoanType === 'Cash Loan');

      const matchesPurpose = selectedPurpose === 'All' || row["Purpose"] === selectedPurpose;
      const matchesDivision = selectedDivision === 'All' || row["Division"] === selectedDivision;

      const postedDate = getPostedDate(row);

      // Strict Posted Month Filter
      let matchesMonth = true;
      if (selectedMonth !== 'All') {
        if (!postedDate) {
          matchesMonth = false;
        } else {
          const monthNum = postedDate.getMonth() + 1;
          matchesMonth = monthNum === parseInt(selectedMonth, 10);
        }
      }

      // Strict Posted Date Range Filter
      let matchesDateRange = true;
      if (fromDate || toDate) {
        if (!postedDate) {
          matchesDateRange = false;
        } else {
          const rowTime = new Date(postedDate.getFullYear(), postedDate.getMonth(), postedDate.getDate()).getTime();

          if (fromDate) {
            const fromTime = new Date(fromDate).getTime();
            if (rowTime < fromTime) matchesDateRange = false;
          }

          if (toDate) {
            const toTime = new Date(toDate).getTime();
            if (rowTime > toTime) matchesDateRange = false;
          }
        }
      }

      // Timeframe Filter
      let matchesTimeframe = true;
      if (selectedTimeframe !== 'All' && postedDate) {
        const year = postedDate.getFullYear();
        if (selectedTimeframe === '2026') matchesTimeframe = year === 2026;
        else if (selectedTimeframe === '2025') matchesTimeframe = year === 2025;
        else if (selectedTimeframe === 'FY') matchesTimeframe = year === 2026;
      }

      return matchesSearch && matchesLoanType && matchesPurpose && matchesDivision && matchesMonth && matchesDateRange && matchesTimeframe;
    });
  }, [loanData, searchTerm, selectedLoanType, selectedPurpose, selectedDivision, selectedMonth, selectedTimeframe, fromDate, toDate]);

  // Dropdown Lists
  const divisionsList = useMemo(() => {
    const set = new Set<string>();
    loanData.forEach(r => { if (r["Division"]) set.add(r["Division"]); });
    return Array.from(set);
  }, [loanData]);

  const purposeList = useMemo(() => {
    const set = new Set<string>();
    loanData.forEach(r => { if (r["Purpose"]) set.add(r["Purpose"]); });
    return Array.from(set);
  }, [loanData]);

  const loanTypesList = useMemo(() => {
    const set = new Set<string>();
    loanData.forEach(r => { if (r["Loan Type"]) set.add(r["Loan Type"]); });
    return Array.from(set);
  }, [loanData]);

  // Top 3 Divisions
  const topDivisions = useMemo(() => {
    const counts: Record<string, { count: number; principal: number }> = {};
    filteredLoans.forEach(row => {
      const div = row["Division"] || "Unspecified";
      const p = parseFloat(String(row["Principal Amount"] || 0)) || 0;
      if (!counts[div]) {
        counts[div] = { count: 0, principal: 0 };
      }
      counts[div].count += 1;
      counts[div].principal += p;
    });

    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.principal - a.principal)
      .slice(0, 3);
  }, [filteredLoans]);

  // Top 3 Purposes
  const topPurposes = useMemo(() => {
    const counts: Record<string, { count: number; principal: number }> = {};
    filteredLoans.forEach(row => {
      const purpose = row["Purpose"] || "Unspecified";
      const p = parseFloat(String(row["Principal Amount"] || 0)) || 0;
      if (!counts[purpose]) {
        counts[purpose] = { count: 0, principal: 0 };
      }
      counts[purpose].count += 1;
      counts[purpose].principal += p;
    });

    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.principal - a.principal)
      .slice(0, 3);
  }, [filteredLoans]);

  // Metrics & Smart Target Progress Computation (STRICTLY Posted Date)
  const metrics = useMemo(() => {
    let totalPrincipal = 0;
    let totalLoanVal = 0;
    let totalNet = 0;

    filteredLoans.forEach(row => {
      totalPrincipal += parseFloat(String(row["Principal Amount"] || 0)) || 0;
      totalLoanVal += parseFloat(String(row["Total Loan"] || 0)) || 0;
      totalNet += parseFloat(String(row["Net Proceeds"] || 0)) || 0;
    });

    let targetMonthPrincipal = totalPrincipal;
    let targetLabel = '';

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Case 1: Specific Month Selected
    if (selectedMonth !== 'All') {
      const activeMonthIndex = parseInt(selectedMonth, 10) - 1;
      targetLabel = `${monthNames[activeMonthIndex]} Posted Target`;

      let monthSum = 0;
      loanData.forEach(row => {
        const postedDate = getPostedDate(row);
        if (postedDate && postedDate.getMonth() === activeMonthIndex) {
          monthSum += parseFloat(String(row["Principal Amount"] || 0)) || 0;
        }
      });
      targetMonthPrincipal = monthSum;
    } 
    // Case 2: Date Range Selected
    else if (toDate || fromDate) {
      const refDate = toDate ? new Date(toDate) : new Date(fromDate);
      if (!isNaN(refDate.getTime())) {
        const activeMonthIndex = refDate.getMonth();
        const activeYear = refDate.getFullYear();
        const endBoundaryTime = toDate ? new Date(toDate).getTime() : new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getTime();

        targetLabel = toDate 
          ? `Posted Target (As of ${toDate})`
          : `${monthNames[activeMonthIndex]} Posted Target`;

        let cumulativeSum = 0;
        loanData.forEach(row => {
          const postedDate = getPostedDate(row);
          if (postedDate) {
            const rowTime = new Date(postedDate.getFullYear(), postedDate.getMonth(), postedDate.getDate()).getTime();
            if (postedDate.getMonth() === activeMonthIndex && postedDate.getFullYear() === activeYear && rowTime <= endBoundaryTime) {
              cumulativeSum += parseFloat(String(row["Principal Amount"] || 0)) || 0;
            }
          }
        });
        targetMonthPrincipal = cumulativeSum;
      }
    }

    const activeTarget = (selectedMonth !== 'All' || fromDate || toDate) ? MONTHLY_TARGET : YEARLY_TARGET;
    const progressPct = Math.min(Math.round((targetMonthPrincipal / activeTarget) * 100), 100);

    return {
      totalPrincipal,
      totalLoanVal,
      totalNet,
      count: filteredLoans.length,
      activeTarget,
      targetMonthPrincipal,
      targetLabel,
      progressPct
    };
  }, [filteredLoans, loanData, selectedMonth, fromDate, toDate]);

  const selectStyle = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#111827',
    backgroundColor: '#ffffff',
    fontWeight: '600' as const,
    cursor: 'pointer',
    outline: 'none'
  };

  const optionStyle = {
    color: '#111827',
    backgroundColor: '#ffffff'
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a', padding: '28px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: '#ffffff', padding: '20px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>SIB KPI Monitoring Dashboard</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '500' }}>Portfolio Performance & Real-Time Posted Tracking</p>
        </div>
        
        <button 
          onClick={fetchData} 
          disabled={loading}
          style={{ padding: '9px 16px', backgroundColor: '#15803d', color: '#ffffff', borderRadius: '6px', border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1, fontWeight: '600', fontSize: '13px' }}
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#15803d', fontWeight: '600', fontSize: '16px' }}>⏳ Kino-connect at kino-kolekta ang data mula sa Google Sheet...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '20px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', fontWeight: '600', fontSize: '14px' }}>
          <div>⚠️ {error}</div>
        </div>
      ) : (
        <>
          {/* SEARCH SECTION */}
          <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <label style={{ display: 'block', fontWeight: '700', fontSize: '12px', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🔎 Search Borrower or Purpose
            </label>
            <input
              type="text"
              placeholder="Search borrower name, division, or loan purpose..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#0f172a', backgroundColor: '#ffffff', boxSizing: 'border-box', outline: 'none', fontWeight: '500' }}
            />
          </div>

          {/* SORT & FILTER SECTION */}
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '16px', color: '#334155', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚙️ Filter Parameters
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
              
              {/* Box 1: Loan Type */}
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Loan Type
                </label>
                <select value={selectedLoanType} onChange={(e) => setSelectedLoanType(e.target.value)} style={selectStyle}>
                  <option value="All" style={optionStyle}>All Loan Types</option>
                  {loanTypesList.map((type, i) => (
                    <option key={i} value={type} style={optionStyle}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Box 2: Purpose */}
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Purpose
                </label>
                <select value={selectedPurpose} onChange={(e) => setSelectedPurpose(e.target.value)} style={selectStyle}>
                  <option value="All" style={optionStyle}>All Purpose ({purposeList.length})</option>
                  {purposeList.map((p, i) => (
                    <option key={i} value={p} style={optionStyle}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Box 3: Division */}
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Division
                </label>
                <select value={selectedDivision} onChange={(e) => setSelectedDivision(e.target.value)} style={selectStyle}>
                  <option value="All" style={optionStyle}>All Divisions ({divisionsList.length})</option>
                  {divisionsList.map((div, i) => (
                    <option key={i} value={div} style={optionStyle}>{div}</option>
                  ))}
                </select>
              </div>

              {/* Box 4: FROM DATE (POSTED) */}
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>
                  From Date (Posted)
                </label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ ...selectStyle, boxSizing: 'border-box' }} />
              </div>

              {/* Box 5: TO DATE (POSTED) */}
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>
                  To Date (Posted)
                </label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ ...selectStyle, boxSizing: 'border-box' }} />
              </div>

              {/* Box 6: Month (POSTED) */}
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Posted Month
                </label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={selectStyle}>
                  <option value="All" style={optionStyle}>All Months</option>
                  <option value="1" style={optionStyle}>January</option>
                  <option value="2" style={optionStyle}>February</option>
                  <option value="3" style={optionStyle}>March</option>
                  <option value="4" style={optionStyle}>April</option>
                  <option value="5" style={optionStyle}>May</option>
                  <option value="6" style={optionStyle}>June</option>
                  <option value="7" style={optionStyle}>July</option>
                  <option value="8" style={optionStyle}>August</option>
                  <option value="9" style={optionStyle}>September</option>
                  <option value="10" style={optionStyle}>October</option>
                  <option value="11" style={optionStyle}>November</option>
                  <option value="12" style={optionStyle}>December</option>
                </select>
              </div>

              {/* Box 7: Timeframe */}
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Timeframe
                </label>
                <select value={selectedTimeframe} onChange={(e) => setSelectedTimeframe(e.target.value)} style={selectStyle}>
                  <option value="All" style={optionStyle}>All Timeframes</option>
                  <option value="2026" style={optionStyle}>Yearly (2026 Target)</option>
                  <option value="2025" style={optionStyle}>Last Year (2025)</option>
                  <option value="FY" style={optionStyle}>Last Fiscal Year (FY 2026)</option>
                </select>
              </div>

            </div>

            {(fromDate || toDate || selectedMonth !== 'All' || selectedLoanType !== 'All' || selectedPurpose !== 'All' || selectedDivision !== 'All' || selectedTimeframe !== 'All' || searchTerm) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedLoanType('All');
                  setSelectedPurpose('All');
                  setSelectedDivision('All');
                  setSelectedMonth('All');
                  setSelectedTimeframe('All');
                  setFromDate('');
                  setToDate('');
                }}
                style={{ marginTop: '14px', padding: '7px 14px', backgroundColor: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#ffffff', fontWeight: '600' }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* KPI CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            
            <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}>Active Loan Count</div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>{metrics.count.toLocaleString()}</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '6px', fontWeight: '500' }}>Filtered Records</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: '4px solid #15803d', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#15803d', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}>Loan Principal Amount</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#15803d', marginTop: '6px' }}>
                ₱{metrics.totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#16a34a', fontSize: '11px', marginTop: '6px', fontWeight: '600' }}>Gross Principal Disbursed</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}>Total Gross Portfolio</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
                ₱{metrics.totalLoanVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '6px', fontWeight: '500' }}>Principal + Interest + Fees</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: '4px solid #b91c1c', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ color: '#b91c1c', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}>Total Net Proceeds</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#b91c1c', marginTop: '6px' }}>
                ₱{metrics.totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ color: '#dc2626', fontSize: '11px', marginTop: '6px', fontWeight: '600' }}>Actual Disbursed</div>
            </div>
          </div>

          {/* TOP 3 DIVISIONS & TOP 3 PURPOSES CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            
            {/* TOP 3 DIVISIONS */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                🏆 Top 3 Divisions (by Volume)
              </h3>
              {topDivisions.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>No records found.</div>
              ) : (
                topDivisions.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: idx < topDivisions.length - 1 ? '1px border-dash #f1f5f9' : 'none' }}>
                    <div>
                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>#{idx + 1} {item.name}</span>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>{item.count} applications</div>
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#15803d' }}>
                      ₱{item.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* TOP 3 PURPOSES */}
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: '700', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                🎯 Top 3 Loan Purposes
              </h3>
              {topPurposes.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>No records found.</div>
              ) : (
                topPurposes.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: idx < topPurposes.length - 1 ? '1px border-dash #f1f5f9' : 'none' }}>
                    <div>
                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>#{idx + 1} {item.name}</span>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>{item.count} applications</div>
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#15803d' }}>
                      ₱{item.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

          {/* TARGET TRACKER */}
          <div style={{ backgroundColor: '#ffffff', padding: '22px 24px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                  🎯 Cash Loan Target Tracking ({metrics.targetLabel ? metrics.targetLabel : '2026 Annual Target'})
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Benchmark Target: {metrics.targetLabel ? '₱1,600,000.00 / Month' : '₱19,200,000.00 / Year'}
                </p>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: metrics.progressPct >= 100 ? '#15803d' : '#b91c1c' }}>
                {metrics.progressPct}% Achieved
              </div>
            </div>

            <div style={{ width: '100%', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: `${metrics.progressPct}%`, 
                  height: '100%', 
                  backgroundColor: metrics.progressPct >= 100 ? '#15803d' : '#b91c1c',
                  transition: 'width 0.4s ease'
                }} 
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', color: '#475569', fontWeight: '500' }}>
              <span>
                Cumulative Principal (As of Posted End Date): 
                <b style={{ color: '#0f172a' }}> ₱{metrics.targetMonthPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>
              </span>
              <span>Target: <b style={{ color: '#0f172a' }}>₱{metrics.activeTarget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></span>
            </div>
          </div>

          {/* DATA TABLE */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', color: '#0f172a' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>Borrower Name</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>Loan Type</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>Purpose</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>Division</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>Loan Date</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>Posted Date</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>Principal Amount</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>Total Loan</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>Net Proceeds</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.slice(0, 100).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#0f172a' }}>{row["Name"]}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#15803d' }}>{row["Loan Type"] || "Cash Loan"}</td>
                      <td style={{ padding: '12px 14px', color: '#334155', fontWeight: '500' }}>{row["Purpose"]}</td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{row["Division"]}</td>
                      <td style={{ padding: '12px 14px', color: '#334155' }}>{row["Loan Date"]}</td>
                      <td style={{ padding: '12px 14px', color: '#15803d', fontWeight: '700' }}>{row["Posted Date"] || "—"}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: '#15803d', backgroundColor: '#f0fdf4' }}>
                        ₱{parseFloat(String(row["Principal Amount"] || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#334155', fontWeight: '500' }}>
                        ₱{parseFloat(String(row["Total Loan"] || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#b91c1c', fontWeight: '700' }}>
                        ₱{parseFloat(String(row["Net Proceeds"] || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center', borderTop: '1px solid #f1f5f9', fontWeight: '500' }}>
              Showing {Math.min(100, filteredLoans.length)} of {filteredLoans.length} filtered records
            </div>
          </div>
        </>
      )}
    </div>
  );
}