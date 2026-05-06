import React from 'react';

const UnauthorizedPage = () => {
  return (
    <div
      style={{ backgroundColor: '#0B1B2B', color: '#FFFFFF', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px' }}
    >
      <div>
        <h1 style={{ fontSize: '4rem', marginBottom: '20px', color: '#FF6F3C' }}>403</h1>
        <h2 style={{ fontSize: '2rem', marginBottom: '10px' }}>Unauthorized Access</h2>
        <p style={{ fontSize: '1.2rem' }}>You do not have permission to view this page.</p>
        <p style={{ fontSize: '1rem', marginTop: '30px' }}>
          Please contact your administrator if you believe this is an error.
        </p>
        <a href="/" style={{ color: '#FF6F3C', textDecoration: 'none', marginTop: '20px', display: 'inline-block', fontSize: '1.1rem' }}>
          Go to Homepage
        </a>
      </div>
    </div>
  );
};

export default UnauthorizedPage;