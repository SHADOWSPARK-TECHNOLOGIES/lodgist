"use client"
import React from 'react';
import withRole from '@/components/with-role';

export const dynamic = 'force-dynamic';

const LandlordDashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-r from-orange-500 to-rose-600 text-white flex items-center justify-center">
      <h1 className="text-4xl font-bold">Landlord Dashboard</h1>
    </div>
  );
};

export default withRole(LandlordDashboard, { allowedRoles: ["LANDLORD"] });