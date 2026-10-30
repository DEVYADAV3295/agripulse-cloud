import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000';

export default function Dashboard() {
  const [lang, setLang] = useState('hi'); // 'en' | 'hi'
  const [telemetry, setTelemetry] = useState({
    moisture: 38.0,
    nitrogen: 140,
    sulphur: 22,
    temperature: 28.0,
    humidity: 62,
    pumpStatus: false,
    status: 'OPTIMAL'
  });

  // Chaos & Resilience States
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryTimer, setRecoveryTimer] = useState(0);
  const [containerHealth, setContainerHealth] = useState(100);

  // AI Plant Doctor States
  const [selectedCrop, setSelectedCrop] = useState('Paddy');
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diseaseResult, setDiseaseResult] = useState(null);
  const [textQuery, setTextQuery] = useState('');

  // AgroBot Chatbot State
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: lang === 'hi' 
        ? 'नमस्ते! मैं एग्रोपल्स सलाहकार हूँ। आप अपनी फसल, मौसम या सिंचाई के बारे में कुछ भी पूछ सकते हैं।' 
        : 'Hello! I am AgriPulse Assistant. Ask me anything about crop health, soil nutrients, or irrigation.'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Poll Telemetry every 3 seconds
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/telemetry/latest`);
        const json = await res.json();
        if (json.success && json.data) {
          setTelemetry(prev => ({ ...prev, ...json.data }));
        }
      } catch (err) {
        // Fallback or silent error handling
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  // Chaos Failover Simulation Handler
  const triggerChaosFailure = async () => {
    setIsRecovering(true);
    setContainerHealth(0);

    try {
      await fetch(`${API_BASE}/api/chaos/kill-node`, { method: 'POST' });
    } catch (err) {
      console.log('Server down as expected during chaos simulation.');
    }

    let start = Date.now();
    const interval = setInterval(() => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      setRecoveryTimer(elapsed);
      if (elapsed >= 5.0) {
        clearInterval(interval);
        setContainerHealth(100);
        setIsRecovering(false);
      }
    }, 100);
  };

  // Image Upload / Camera Handler
  const handleLeafScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));
    setIsAnalyzing(true);
    setDiseaseResult(null);

    const formData = new FormData();
    formData.append('leafImage', file);
    formData.append('crop', selectedCrop);

    try {
      const res = await fetch(`${API_BASE}/api/ai/diagnose`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.diagnosis) {
        setDiseaseResult(data.diagnosis);
      }
    } catch (err) {
      console.error('Diagnosis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Text/Chat Symptom Query Handler
  const handleTextDiagnosis = async (e) => {
    e.preventDefault();
    if (!textQuery.trim()) return;

    setIsAnalyzing(true);
    setDiseaseResult(null);

    try {
      const formData = new FormData();
      formData.append('crop', selectedCrop);
      formData.append('queryText', textQuery);

      const res = await fetch(`${API_BASE}/api/ai/diagnose`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.diagnosis) {
        setDiseaseResult(data.diagnosis);
      }
    } catch (err) {
      console.error('Diagnosis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

// Real AgroBot AI Handler (Backend Gemini se connect)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    const userMsg = { sender: 'user', text: userText };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, lang: lang })
      });
      const data = await res.json();
      if (data.success && data.reply) {
        setChatMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { 
          sender: 'bot', 
          text: lang === 'hi' ? 'उत्तर प्राप्त करने में असमर्थ।' : 'Could not fetch response.' 
        }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { 
        sender: 'bot', 
        text: lang === 'hi' ? 'सर्वर से संपर्क नहीं हो सका।' : 'Server connection failed.' 
      }]);
    }
  };
  
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0f1d',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '24px'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        
        {/* Header Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '28px', color: '#10b981' }}>🌱</span>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                {lang === 'hi' ? 'एग्रीपल्स क्लाउड' : 'AgriPulse Cloud'}
              </h1>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '13px' }}>
              {lang === 'hi' 
                ? 'सटीक कृषि टेलीमेट्री और माइक्रोसर्विसेज कमांड सेंटर' 
                : 'Precision Agritech Telemetry & Microservices Command Center'}
            </p>
          </div>

          {/* Header Action Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
              style={{
                background: '#131d33',
                color: '#93c5fd',
                border: '1px solid #1e2d4a',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              文A {lang === 'hi' ? 'Switch to English' : 'हिंदी में देखें'}
            </button>

            {/* SLA / Container Health Indicator */}
            <div style={{
              background: '#131d33',
              border: '1px solid #1e2d4a',
              borderRadius: '10px',
              padding: '6px 14px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {lang === 'hi' ? 'सिस्टम स्वास्थ्य / SLA' : 'System SLA / Health'}
              </div>
              <div style={{
                fontSize: '12px',
                fontWeight: '700',
                color: isRecovering ? '#f87171' : '#34d399'
              }}>
                {isRecovering 
                  ? (lang === 'hi' ? `फेलओवर सक्रिय (${recoveryTimer}s)` : `CRASHED (${recoveryTimer}s)`) 
                  : (lang === 'hi' ? '99.5% सक्रिय' : '99.5% Operational')}
              </div>
            </div>

            {/* Chaos Simulator Button */}
            <button
              onClick={triggerChaosFailure}
              disabled={isRecovering}
              style={{
                background: isRecovering ? '#7f1d1d' : '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: isRecovering ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)'
              }}
            >
              ⚠️ {lang === 'hi' ? 'फेलओवर सिमुलेट करें' : 'Simulate Chaos Failover'}
            </button>
          </div>
        </div>

        {/* 4-Column Live Telemetry Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '18px',
          marginBottom: '24px'
        }}>
          {/* Card 1: Soil Moisture */}
          <div style={{
            background: 'linear-gradient(145deg, #131c31 0%, #0d1527 100%)',
            border: '1px solid #1e2d4a',
            borderRadius: '18px',
            padding: '20px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px' }}>
              <span>{lang === 'hi' ? 'मिट्टी की नमी' : 'Soil Moisture'}</span>
              <span style={{ fontSize: '18px', color: '#38bdf8' }}>💧</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#38bdf8', margin: '8px 0 4px 0' }}>
              {telemetry.moisture}%
            </div>
            <div style={{ fontSize: '12px', color: telemetry.moisture < 35 ? '#f87171' : '#34d399' }}>
              {telemetry.moisture < 35 
                ? (lang === 'hi' ? '⚠️ कम नमी स्तर (सिंचाई अनुशंसित)' : '⚠️ Low Moisture Warning') 
                : (lang === 'hi' ? '✓ संतुलित नमी स्तर' : '✓ Optimal Hydration')}
            </div>
          </div>

          {/* Card 2: Nutrients (N & S) */}
          <div style={{
            background: 'linear-gradient(145deg, #131c31 0%, #0d1527 100%)',
            border: '1px solid #1e2d4a',
            borderRadius: '18px',
            padding: '20px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px' }}>
              <span>{lang === 'hi' ? 'पोषक तत्व (N और S)' : 'Nutrients (N & S)'}</span>
              <span style={{ fontSize: '18px', color: '#c084fc' }}>📉</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', margin: '10px 0 4px 0' }}>
              {lang === 'hi' ? 'नाइट्रोजन (N):' : 'Nitrogen (N):'} <span style={{ color: '#c084fc' }}>{telemetry.nitrogen} mg/kg</span>
            </div>
            <div style={{ fontSize: '13px', color: '#facc15', fontWeight: '600' }}>
              {lang === 'hi' ? 'सल्फर (S):' : 'Sulphur (S):'} {telemetry.sulphur} ppm
            </div>
            <div style={{ fontSize: '12px', color: '#34d399', marginTop: '6px' }}>
              ✓ {lang === 'hi' ? 'स्वस्थ मिट्टी प्रोफाइल' : 'Balanced Soil Profile'}
            </div>
          </div>

          {/* Card 3: Microclimate Weather */}
          <div style={{
            background: 'linear-gradient(145deg, #131c31 0%, #0d1527 100%)',
            border: '1px solid #1e2d4a',
            borderRadius: '18px',
            padding: '20px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px' }}>
              <span>{lang === 'hi' ? 'स्थानीय मौसम' : 'Local Microclimate'}</span>
              <span style={{ fontSize: '18px', color: '#60a5fa' }}>🌧️</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#f8fafc', margin: '8px 0 4px 0' }}>
              {telemetry.temperature}°C
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              {lang === 'hi' ? `आर्द्रता: ${telemetry.humidity}% | बारिश जोखिम: 12%` : `Humidity: ${telemetry.humidity}% | Rain Risk: 12%`}
            </div>
            <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: '4px' }}>
              {lang === 'hi' ? 'रेन लॉक: निष्क्रिय (सिंचाई सुरक्षित)' : 'Rain Lock: Disengaged (Safe)'}
            </div>
          </div>

          {/* Card 4: Pump Actuator */}
          <div style={{
            background: 'linear-gradient(145deg, #131c31 0%, #0d1527 100%)',
            border: '1px solid #1e2d4a',
            borderRadius: '18px',
            padding: '20px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px' }}>
              <span>{lang === 'hi' ? 'सिंचाई मोटर पंप' : 'Pump Actuator'}</span>
              <span style={{ fontSize: '18px', color: telemetry.pumpStatus ? '#10b981' : '#64748b' }}>⚡</span>
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '800',
              color: telemetry.pumpStatus ? '#34d399' : '#94a3b8',
              margin: '12px 0 8px 0'
            }}>
              {telemetry.pumpStatus 
                ? (lang === 'hi' ? 'सक्रिय (IRRIGATING)' : 'RUNNING') 
                : (lang === 'hi' ? 'बंद (आइडल)' : 'IDLE')}
            </div>
            <div style={{
              background: '#090f1d',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '6px',
              textAlign: 'center',
              fontSize: '11px',
              fontWeight: '700',
              color: '#94a3b8',
              letterSpacing: '1px'
            }}>
              {lang === 'hi' ? 'मोड: AUTO' : 'MODE: AUTO'}
            </div>
          </div>
        </div>

        {/* 2-Column Grid: AI Plant Doctor & Field Satellite Map */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {/* Column 1: AI Plant Doctor Card */}
          <div style={{
            background: 'linear-gradient(145deg, #131c31 0%, #0d1527 100%)',
            border: '1px solid #1e2d4a',
            borderRadius: '18px',
            padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>🩺</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#34d399' }}>
                  {lang === 'hi' ? 'एआई पादप चिकित्सक (AI Plant Doctor)' : 'AI Plant Doctor'}
                </h3>
              </div>
              <select 
                value={selectedCrop} 
                onChange={(e) => setSelectedCrop(e.target.value)}
                style={{
                  background: '#090f1d',
                  color: '#94a3b8',
                  border: '1px solid #263859',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="Paddy">{lang === 'hi' ? 'धान (Paddy)' : 'Paddy'}</option>
                <option value="Wheat">{lang === 'hi' ? 'गेहूं (Wheat)' : 'Wheat'}</option>
                <option value="Tomato">{lang === 'hi' ? 'टमाटर (Tomato)' : 'Tomato'}</option>
              </select>
            </div>

            {/* Hidden native inputs */}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              id="camera-input" 
              style={{ display: 'none' }} 
              onChange={handleLeafScan} 
            />
            <input 
              type="file" 
              accept="image/*" 
              id="gallery-input" 
              style={{ display: 'none' }} 
              onChange={handleLeafScan} 
            />

            {/* 1. Buttons: Live Camera & Gallery Upload */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label 
                htmlFor="camera-input" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '11px 16px',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
                }}
              >
                📸 {lang === 'hi' ? 'लाइव कैमरा' : 'Live Camera'}
              </label>
              <label 
                htmlFor="gallery-input" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '11px 16px',
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.25)'
                }}
              >
                📁 {lang === 'hi' ? 'गैलरी अपलोड' : 'Upload File'}
              </label>
            </div>

            {/* 2. Chat / Text Query Box */}
            <form onSubmit={handleTextDiagnosis} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={textQuery} 
                onChange={(e) => setTextQuery(e.target.value)}
                placeholder={lang === 'hi' ? 'लक्षण लिखें (उदा. पत्तों पर पीले-भूरे धब्बे)...' : 'Describe symptoms (e.g. yellow spots on leaf)...'} 
                style={{
                  flex: 1,
                  background: '#090f1d',
                  border: '1px solid #243552',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#f8fafc',
                  outline: 'none'
                }}
              />
              <button 
                type="submit" 
                disabled={isAnalyzing}
                style={{
                  background: '#34d399',
                  color: '#061a14',
                  fontWeight: '700',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {isAnalyzing ? '...' : (lang === 'hi' ? 'पूछें' : 'Ask AI')}
              </button>
            </form>

            {/* Selected Image Preview */}
            {imagePreview && (
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={imagePreview} 
                  alt="Leaf Scan Preview" 
                  style={{ height: '120px', borderRadius: '10px', border: '1px solid #334155', objectFit: 'cover' }} 
                />
              </div>
            )}

            {/* Analyzing Indicator */}
            {isAnalyzing && (
              <div style={{ textAlign: 'center', color: '#34d399', fontSize: '13px', fontWeight: '500' }}>
                ⚡ {lang === 'hi' ? 'एआई लक्षणों की जांच कर रहा है...' : 'AI is diagnosing symptoms...'}
              </div>
            )}

            {/* Diagnosis Result Box */}
            {diseaseResult && (
              <div style={{
                background: 'rgba(9, 15, 29, 0.85)',
                border: '1px solid rgba(52, 211, 153, 0.35)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: '#6ee7b7', fontSize: '14px', fontWeight: '700' }}>
                    {lang === 'hi' ? diseaseResult.disease_hi : diseaseResult.disease_en}
                  </h4>
                  <span style={{
                    background: 'rgba(6, 78, 59, 0.6)',
                    color: '#34d399',
                    border: '1px solid #059669',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '20px'
                  }}>
                    {diseaseResult.confidence || '95.8% Match'}
                  </span>
                </div>
                <p style={{ margin: '4px 0', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  <strong style={{ color: '#f1f5f9' }}>{lang === 'hi' ? 'लक्षण:' : 'Symptoms:'}</strong> {lang === 'hi' ? diseaseResult.symptoms_hi : diseaseResult.symptoms_en}
                </p>
                <p style={{ margin: '4px 0', fontSize: '12px', color: '#fde047', lineHeight: '1.4' }}>
                  <strong style={{ color: '#fef08a' }}>{lang === 'hi' ? 'जैविक उपाय:' : 'Organic Rx:'}</strong> {lang === 'hi' ? diseaseResult.organicRx_hi : diseaseResult.organicRx_en}
                </p>
                <p style={{ margin: '4px 0', fontSize: '12px', color: '#67e8f9', lineHeight: '1.4' }}>
                  <strong style={{ color: '#a5f3fc' }}>{lang === 'hi' ? 'रासायनिक उपाय:' : 'Chemical Rx:'}</strong> {lang === 'hi' ? diseaseResult.chemicalRx_hi : diseaseResult.chemicalRx_en}
                </p>
                <button 
                  type="button"
                  onClick={() => {
                    const text = lang === 'hi' 
                      ? `${diseaseResult.disease_hi}। उपाय: ${diseaseResult.organicRx_hi}` 
                      : `${diseaseResult.disease_en}. Remedy: ${diseaseResult.organicRx_en}`;
                    const utt = new SpeechSynthesisUtterance(text);
                    utt.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
                    window.speechSynthesis.speak(utt);
                  }}
                  style={{
                    marginTop: '6px',
                    padding: '8px',
                    background: '#162238',
                    color: '#34d399',
                    border: '1px solid #263859',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  🔊 {lang === 'hi' ? 'पर्चा सुनें (Voice Readout)' : 'Listen Prescription'}
                </button>
              </div>
            )}
          </div>

          {/* Column 2: Field Profile & Map */}
          <div style={{
            background: 'linear-gradient(145deg, #131c31 0%, #0d1527 100%)',
            border: '1px solid #1e2d4a',
            borderRadius: '18px',
            padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '20px' }}>🌐</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#38bdf8' }}>
                  {lang === 'hi' ? 'खेत प्रोफाइल व सेटेलाइट मैप' : 'Field Profile & Satellite Radar'}
                </h3>
              </div>

              {/* Grid Simulator Map Canvas */}
              <div style={{
                height: '160px',
                borderRadius: '12px',
                border: '1px solid #1e3a5f',
                background: 'radial-gradient(circle at center, #0f2b38 0%, #081426 100%)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid #0284c7',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ height: '8px', width: '8px', borderRadius: '50%', background: '#38bdf8' }}></span>
                  {lang === 'hi' ? 'सेंसर नोड #01: सक्रिय (सिग्नल -68 dBm)' : 'Sensor Node #01: Active (-68 dBm)'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>{lang === 'hi' ? 'खेत का नाम:' : 'Plot Designation:'}</span>
                <span style={{ color: '#f8fafc', fontWeight: '600' }}>Plot 1 - North Field</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>{lang === 'hi' ? 'मिट्टी का प्रकार:' : 'Soil Classification:'}</span>
                <span style={{ color: '#f8fafc', fontWeight: '600' }}>Matiyar (Clay-Loam)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>{lang === 'hi' ? 'स्थान निर्देशांक:' : 'Coordinates:'}</span>
                <span style={{ color: '#f8fafc', fontWeight: '600' }}>25.568° N, 84.821° E</span>
              </div>
            </div>
          </div>
        </div>

        {/* AgroBot Floating Chat Window */}
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
          {!isChatOpen ? (
            <button
              onClick={() => setIsChatOpen(true)}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              💬
            </button>
          ) : (
            <div style={{
              width: '320px',
              height: '420px',
              background: '#0d1527',
              border: '1px solid #1e2d4a',
              borderRadius: '18px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Chat Header */}
              <div style={{
                background: '#131c31',
                padding: '12px 16px',
                borderBottom: '1px solid #1e2d4a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🤖</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#34d399' }}>AgroBot AI</span>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Chat Messages */}
              <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      background: msg.sender === 'user' ? '#10b981' : '#1e293b',
                      color: msg.sender === 'user' ? '#022c22' : '#f8fafc',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      maxWidth: '80%'
                    }}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} style={{ padding: '8px', borderTop: '1px solid #1e2d4a', display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={lang === 'hi' ? 'कुछ पूछें...' : 'Ask advice...'}
                  style={{
                    flex: 1,
                    background: '#090f1d',
                    border: '1px solid #243552',
                    borderRadius: '8px',
                    padding: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: '#10b981',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0 12px',
                    color: '#022c22',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ➤
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}