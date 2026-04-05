import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, socket } from '../api/client';

const IntelligenceContext = createContext();

export const IntelligenceProvider = ({ children }) => {
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [notification, setNotification] = useState(null);

  const fetchData = async () => {
    try {
      const [polRes, claimRes] = await Promise.all([
        api.get('/policies'),
        api.get('/claims')
      ]);
      setPolicies(polRes.data);
      setClaims(claimRes.data);
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    }
  };

  useEffect(() => {
    fetchData();

    // The Global Event Listener
    socket.on('intelligenceUpdate', (data) => {
      fetchData(); // Silently pull fresh data
      
      if (data.type === 'RISK_ESCALATION') {
        setNotification({
          title: "Agentic Intervention",
          message: `Live SIU Routing detected. Policy ${data.policyId} dynamically adjusted.`,
          type: 'warning'
        });
      }
    });

    return () => socket.off('intelligenceUpdate');
  }, []);

  const submitFNOL = async (claimData) => {
    await api.post('/claims', claimData);
  };

  const updateClaimStatus = async (claimId, newStatus) => {
    await api.put(`/claims/${claimId}/status`, { status: newStatus });
  };

  return (
    <IntelligenceContext.Provider value={{
      policies, claims, submitFNOL, updateClaimStatus, notification, setNotification
    }}>
      {children}
    </IntelligenceContext.Provider>
  );
};

export const useIntelligence = () => useContext(IntelligenceContext);
