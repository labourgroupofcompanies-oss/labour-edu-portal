import React, { useState } from 'react';

const SDK_LIST = [
  {
    id: 'javascript',
    name: 'JavaScript / Web Browser SDK',
    version: 'v1.2.0',
    installCmd: 'npm install @labour-edu/sdk',
    icon: 'fa-square-js',
    color: '#f7df1e',
    desc: 'Lightweight client library for React, Vue, or Vanilla JS applications with built-in Dexie offline caching.',
    snippet: `import { LabourEduClient } from '@labour-edu/sdk';

const client = new LabourEduClient({
  apiKey: 'pk_live_your_api_key',
  environment: 'production'
});

// Fetch learner report cards
const reports = await client.reports.getByClass({ className: 'Basic 6' });`
  },
  {
    id: 'nodejs',
    name: 'Node.js Server SDK',
    version: 'v1.2.0',
    installCmd: 'npm install @labour-edu/node',
    icon: 'fa-node-js',
    color: '#68a063',
    desc: 'Server-side Node.js SDK for backend school management microservices and automated grade imports.',
    snippet: `const { LabourEduNode } = require('@labour-edu/node');

const sdk = new LabourEduNode({
  apiKey: process.env.LABOUR_EDU_KEY
});

// Submit terminal marks
await sdk.scores.submitBatch({
  classId: 'cls_b6a',
  term: 2,
  scores: [{ learnerId: 'lrn_101', classScore: 40, examScore: 48 }]
});`
  },
  {
    id: 'python',
    name: 'Python SDK',
    version: 'v1.1.4',
    installCmd: 'pip install labour-edu-python',
    icon: 'fa-python',
    color: '#3776ab',
    desc: 'Python client library for educational analytics, data science pipelines, and pandas dataframes.',
    snippet: `from labour_edu import LabourEduClient

client = LabourEduClient(api_key="pk_live_your_api_key")

# Load learner performance dataframe
df = client.analytics.get_class_performance_df(school_id="sch_99381a7b")
print(df.describe())`
  },
  {
    id: 'php',
    name: 'PHP Composer SDK',
    version: 'v1.0.8',
    installCmd: 'composer require labour-edu/php-sdk',
    icon: 'fa-php',
    color: '#777bb4',
    desc: 'PHP client library supporting Laravel, Symfony, and legacy Ghanaian school portal integrations.',
    snippet: `<?php
use LabourEdu\\Client;

$client = new Client(['api_key' => 'pk_live_your_api_key']);
$learners = $client->learners->all(['class' => 'Basic 6A']);`
  },
  {
    id: 'rest',
    name: 'Direct OpenAPI REST Client',
    version: 'v1.2.0',
    installCmd: 'curl -X GET https://api.laboureducational.edu.gh/v1/openapi.json',
    icon: 'fa-network-wired',
    color: '#38bdf8',
    desc: 'Raw REST API integration using any language supporting HTTP/1.1 or HTTP/2.',
    snippet: `curl -X GET "https://api.laboureducational.edu.gh/v1/schools" \\
  -H "X-API-Key: pk_live_your_api_key" \\
  -H "Content-Type: application/json"`
  }
];

const SdkDownloads = () => {
  const [selectedSdk, setSelectedSdk] = useState('javascript');
  const [copiedId, setCopiedId] = useState(null);

  const activeSdk = SDK_LIST.find(s => s.id === selectedSdk) || SDK_LIST[0];

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title */}
      <div>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.75rem', fontWeight: 800, color: 'white', margin: 0 }}>
          SDK Downloads & Developer Tools
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0.25rem 0 0' }}>
          Official client libraries, package installation commands, and quickstart initialization snippets.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {SDK_LIST.map(sdk => (
            <div
              key={sdk.id}
              onClick={() => setSelectedSdk(sdk.id)}
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                background: selectedSdk === sdk.id ? 'rgba(37, 99, 235, 0.12)' : '#121215',
                border: `1px solid ${selectedSdk === sdk.id ? '#2563eb' : '#222226'}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid #222226', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', color: sdk.color, flexShrink: 0 }}>
                <i className={`fab ${sdk.icon.startsWith('fa-') ? 'fas' : 'fab'} ${sdk.icon}`}></i>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#fafafa', fontSize: '0.88rem' }}>{sdk.name}</div>
                <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '2px' }}>{sdk.version}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Active Detail */}
        <div style={{
          background: '#121215',
          borderRadius: '12px',
          border: '1px solid #222226',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', margin: 0, color: '#fafafa', fontSize: '1.25rem', fontWeight: 700 }}>{activeSdk.name}</h2>
              <span style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(37,99,235,0.12)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.25)' }}>
                {activeSdk.version}
              </span>
            </div>
            <p style={{ color: '#a1a1aa', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>{activeSdk.desc}</p>
          </div>

          {/* Installation Command */}
          <div>
            <div style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: 600, marginBottom: '0.4rem' }}>Installation Package</div>
            <div style={{ background: '#18181c', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #222226', fontFamily: 'monospace', color: '#34d399', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ wordBreak: 'break-all' }}>{activeSdk.installCmd}</span>
              <button
                onClick={() => handleCopy(activeSdk.installCmd, `cmd-${activeSdk.id}`)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', background: copiedId === `cmd-${activeSdk.id}` ? 'rgba(52,211,153,0.15)' : '#2563eb', border: copiedId === `cmd-${activeSdk.id}` ? '1px solid rgba(52,211,153,0.3)' : 'none', color: copiedId === `cmd-${activeSdk.id}` ? '#34d399' : 'white', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0 }}
              >
                {copiedId === `cmd-${activeSdk.id}` ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Quickstart Snippet */}
          <div>
            <div style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: 600, marginBottom: '0.4rem' }}>Quickstart Code Example</div>
            <pre style={{ background: '#0d0d10', padding: '1rem', borderRadius: '8px', border: '1px solid #222226', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.5, margin: 0, overflowX: 'auto' }}>
              {activeSdk.snippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SdkDownloads;
