import React, { useState, useEffect } from 'react';
import APBillingView from './APBillingView';
import SATBillingView from './SATBillingView';
import UnifiedBillingView from './UnifiedBillingView';
import FinancialSummaryView from './FinancialSummaryView';
import PricingManager from './PricingManager';
import { db } from '../../../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export default function BusinessConsole() {
    const [activeTab, setActiveTab] = useState('summary');

    // Smart default cycle calculation
    const getSmartDefaults = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 1-12
        // School year: if month is August (8) or later, school year finishes in year+1
        const schoolYearGrad = month >= 8 ? year + 1 : year;
        const apDefault = `May ${schoolYearGrad}`;
        const satDefault = (month >= 8 || month <= 1) ? `Fall ${year}` : `Spring ${year}`;
        return { apDefault, satDefault };
    };

    const { apDefault, satDefault } = getSmartDefaults();

    const [billingSettings, setBillingSettings] = useState({
        apCycle: apDefault,
        satCycle: satDefault
    });
    const [pricing, setPricing] = useState(null);

    useEffect(() => {
        const unsubSettings = onSnapshot(doc(db, 'settings', 'billing'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBillingSettings({
                    apCycle: data.apCycle !== undefined && data.apCycle !== '' ? data.apCycle : apDefault,
                    satCycle: data.satCycle !== undefined && data.satCycle !== '' ? data.satCycle : satDefault
                });
            }
        });

        const unsubPricing = onSnapshot(doc(db, 'settings', 'pricing'), (docSnap) => {
            if (docSnap.exists()) {
                setPricing(docSnap.data());
            } else {
                setPricing({
                    apStandard: 99, apReduced: 62, apLateOrder: 40, apLateTest: 40, apUnused: 40,
                    satStandard: 60, satReduced: 18
                });
            }
        });

        return () => { unsubSettings(); unsubPricing(); };
    }, []);

    const updateCycle = async (key, val) => {
        try {
            await setDoc(doc(db, 'settings', 'billing'), {
                [key]: val,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.error("Error updating billing cycle:", e);
        }
    };

    const tabStyle = (id) => ({
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: 'bold',
        color: activeTab === id ? 'var(--fa-blue)' : 'var(--fa-warm-gray)',
        borderBottom: activeTab === id ? '3px solid var(--fa-blue)' : '3px solid transparent',
        backgroundColor: 'transparent',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
            {/* Header Tabs */}
            <div className="glass-panel no-print" style={{ padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <button onClick={() => setActiveTab('summary')} style={tabStyle('summary')}>
                        📈 Master Financial Summary
                    </button>
                    <button onClick={() => setActiveTab('unified')} style={tabStyle('unified')}>
                        🧾 Unified Master Billing
                    </button>
                    <button onClick={() => setActiveTab('ap')} style={tabStyle('ap')}>
                        📊 AP Billing
                    </button>
                    <button onClick={() => setActiveTab('sat')} style={tabStyle('sat')}>
                        📊 SAT / PSAT Billing
                    </button>
                    <button onClick={() => setActiveTab('pricing')} style={tabStyle('pricing')}>
                        ⚙️ Master Pricing Config
                    </button>
                </div>
                <div style={{ padding: '8px 16px', background: 'rgba(0, 70, 139, 0.05)', borderRadius: '8px', color: 'var(--fa-dark-blue)', fontWeight: 'bold', fontSize: '12px' }}>
                    Business Office Workspace
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1 }}>
                {activeTab === 'summary' && (
                    <FinancialSummaryView 
                        apCycle={billingSettings.apCycle} 
                        satCycle={billingSettings.satCycle} 
                        onCycleChange={updateCycle}
                    />
                )}
                {activeTab === 'unified' && <UnifiedBillingView pricing={pricing} />}
                {activeTab === 'ap' && <APBillingView cycle={billingSettings.apCycle} onCycleChange={(v) => updateCycle('apCycle', v)} pricing={pricing} />}
                {activeTab === 'sat' && <SATBillingView cycle={billingSettings.satCycle} onCycleChange={(v) => updateCycle('satCycle', v)} pricing={pricing} />}
                {activeTab === 'pricing' && (
                    <PricingManager 
                        billingSettings={billingSettings} 
                        onCycleChange={updateCycle} 
                    />
                )}
            </div>
        </div>
    );
}
