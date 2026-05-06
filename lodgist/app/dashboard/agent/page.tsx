"use client"
import React from 'react';
import withRole from '@/components/with-role';

export const dynamic = 'force-dynamic';

const AgentDashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-r from-green-600 to-emerald-700 text-white flex items-center justify-center">
      <h1 className="text-4xl font-bold">Agent Dashboard</h1>
    </div>
  );
};

export default withRole(AgentDashboard, { allowedRoles: ["AGENT"] });