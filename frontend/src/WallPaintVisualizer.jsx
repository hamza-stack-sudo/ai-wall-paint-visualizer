import React, { useState, useRef, useEffect } from 'react';

const WallPaintVisualizer = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [paintedImage, setPaintedImage] = useState(null);
  const [maskVisualization, setMaskVisualization] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#FF5733');
  const [opacity, setOpacity] = useState(0.7);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [detectedWalls, setDetectedWalls] = useState([]);
  const [selectedWalls, setSelectedWalls] = useState([]);
  const [mainWallsOnly, setMainWallsOnly] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('checking');
  const [imageHash, setImageHash] = useState(null);
  const [isWallsDetected, setIsWallsDetected] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [detectionTime, setDetectionTime] = useState(0);
  const [paintTime, setPaintTime] = useState(0);
  
  const fileInputRef = useRef();
  const API_BASE_URL = 'http://localhost:5000/api';

  const colorPalette = [
    { name: 'Coral', hex: '#FF5733' },
    { name: 'Mint', hex: '#33FF57' },
    { name: 'Ocean', hex: '#3357FF' },
    { name: 'Rose', hex: '#FF33F1' },
    { name: 'Sunshine', hex: '#F1FF33' },
    { name: 'Aqua', hex: '#33F1FF' },
    { name: 'Peach', hex: '#FF8C33' },
    { name: 'Lavender', hex: '#8C33FF' },
    { name: 'Sage', hex: '#33FF8C' },
    { name: 'Cherry', hex: '#FF3333' },
    { name: 'Lemon', hex: '#FFFF33' },
    { name: 'Cyan', hex: '#33FFFF' },
    { name: 'Magenta', hex: '#FF33CC' },
    { name: 'Lime', hex: '#CCFF33' },
    { name: 'Sky', hex: '#33CCFF' },
    { name: 'Orange', hex: '#FFA500' },
    { name: 'Purple', hex: '#800080' },
    { name: 'Forest', hex: '#008000' },
    { name: 'Pink', hex: '#FFB6C1' },
    { name: 'Teal', hex: '#20B2AA' },
  ];

  useEffect(() => {
    checkApiHealth();
  }, []);

  // Auto-paint when color or opacity changes (if walls already detected)
  useEffect(() => {
    if (isWallsDetected && !isDetecting && selectedWalls.length > 0) {
      const timeoutId = setTimeout(() => {
        paintWallsInstant();
      }, 300); // Debounce for smooth slider movement
      return () => clearTimeout(timeoutId);
    }
  }, [selectedColor, opacity, mainWallsOnly]);

  // Auto-paint when wall selection changes
  useEffect(() => {
    if (isWallsDetected && !isDetecting && selectedWalls.length > 0) {
      paintWallsInstant();
    }
  }, [selectedWalls]);

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      setApiStatus(data.sam_loaded ? 'ready' : 'model_not_loaded');
      console.log('✓ API Status:', data);
    } catch (error) {
      setApiStatus('offline');
      console.error('✗ API Health Check Failed:', error);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        setError('File size must be less than 16MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      // Reset everything
      setSelectedImage(file);
      setError('');
      setPaintedImage(null);
      setMaskVisualization(null);
      setDetectedWalls([]);
      setSelectedWalls([]);
      setIsWallsDetected(false);
      setImageHash(null);
      setShowComparison(false);
      setDetectionTime(0);
      setPaintTime(0);

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const detectWallsOnce = async () => {
    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }

    setIsDetecting(true);
    setError('');
    console.log('🔍 Starting wall detection...');
    const startTime = Date.now();

    try {
      const base64Image = await convertImageToBase64(selectedImage);
      
      const response = await fetch(`${API_BASE_URL}/detect-walls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });

      const data = await response.json();
      const detectionTimeMs = Date.now() - startTime;
      setDetectionTime(detectionTimeMs / 1000);

      if (data.success) {
        setDetectedWalls(data.wall_info);
        setSelectedWalls(data.wall_info.map((_, index) => index));
        setImageHash(data.image_hash);
        setIsWallsDetected(true);
        
        console.log(`✅ Detection complete! Found ${data.wall_info.length} walls in ${(detectionTimeMs/1000).toFixed(1)}s`);
        console.log(`🎯 Image cached with hash: ${data.image_hash}`);
        
        if (data.wall_info.length === 0) {
          setError('No walls detected. Try a different image with clear wall surfaces.');
        } else {
          // Auto-paint with default color
          setTimeout(() => paintWallsInstant(), 500);
        }
      } else {
        setError(data.error || 'Failed to detect walls');
      }
    } catch (error) {
      setError(`Detection failed: ${error.message}`);
      console.error('Detection error:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  const paintWallsInstant = async () => {
    if (!imageHash) {
      setError('Please detect walls first');
      return;
    }

    if (selectedWalls.length === 0) {
      setPaintedImage(null);
      return;
    }

    setIsPainting(true);
    const startTime = Date.now();

    try {
      const response = await fetch(`${API_BASE_URL}/paint-instant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_hash: imageHash,
          color: selectedColor,
          opacity: opacity,
          mainWallsOnly: mainWallsOnly,
          wall_ids: selectedWalls
        })
      });

      const data = await response.json();
      const paintTimeMs = Date.now() - startTime;
      setPaintTime(paintTimeMs / 1000);

      if (data.success) {
        setPaintedImage(data.result_image);
        console.log(`Paint: ${paintTimeMs}ms (${data.walls_painted} walls)`);
      } else {
        setError(data.error || 'Failed to paint walls');
      }
    } catch (error) {
      setError(`Painting failed: ${error.message}`);
      console.error('Paint error:', error);
    } finally {
      setIsPainting(false);
    }
  };

  const visualizeMasks = async () => {
    if (!imageHash) {
      setError('Please detect walls first');
      return;
    }

    setIsDetecting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/visualize-masks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_hash: imageHash })
      });

      const data = await response.json();
      if (data.success) {
        setMaskVisualization(data.visualization);
        console.log(`✓ Mask visualization created`);
      } else {
        setError(data.error || 'Failed to create visualization');
      }
    } catch (error) {
      setError(`Visualization failed: ${error.message}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const toggleWallSelection = (wallIndex) => {
    setSelectedWalls(prev => {
      if (prev.includes(wallIndex)) {
        return prev.filter(id => id !== wallIndex);
      } else {
        return [...prev, wallIndex];
      }
    });
  };

  const downloadImage = () => {
    if (!paintedImage) return;
    const link = document.createElement('a');
    link.href = paintedImage;
    link.download = `painted-wall-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAll = () => {
    setSelectedImage(null);
    setPreviewImage(null);
    setPaintedImage(null);
    setMaskVisualization(null);
    setDetectedWalls([]);
    setSelectedWalls([]);
    setIsWallsDetected(false);
    setImageHash(null);
    setError('');
    setShowComparison(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }

        button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }

        button:active:not(:disabled) {
          transform: translateY(0);
        }

        .color-swatch:hover {
          transform: scale(1.15);
        }

        .wall-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.1);
        }

        .instant-badge {
          animation: pulse 2s infinite;
        }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>AI powred Wall Paint Visualizer</h1>
        <p style={styles.subtitle}>
          Paint instantly • Visualizer Paint on your wall 
        </p>
        
        <div style={styles.statusContainer}>
          <div style={{
            ...styles.statusBadge,
            backgroundColor: apiStatus === 'ready' ? '#d1fae5' : 
                           apiStatus === 'model_not_loaded' ? '#fef3c7' : '#fee2e2',
            color: apiStatus === 'ready' ? '#065f46' :
                   apiStatus === 'model_not_loaded' ? '#92400e' : '#991b1b'
          }}>
            <div style={{
              ...styles.statusDot,
              backgroundColor: apiStatus === 'ready' ? '#10b981' :
                             apiStatus === 'model_not_loaded' ? '#f59e0b' : '#ef4444'
            }}></div>
            {apiStatus === 'ready' ? '✓ AI Ready' :
             apiStatus === 'model_not_loaded' ? 'Loading AI...' :
             '✗ Start Flask Server'}
          </div>
          
          {isWallsDetected && (
            <div style={{...styles.statusBadge, backgroundColor: '#e0e7ff', color: '#3730a3'}} className="instant-badge">
              <div style={{...styles.statusDot, backgroundColor: '#6366f1'}}></div>
              ⚡ Instant Mode Active
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={styles.errorBox}>
          <strong>⚠️ Error:</strong> {error}
          <button onClick={() => setError('')} style={styles.closeError}>✕</button>
        </div>
      )}

      {/* Upload Section */}
      <div style={styles.uploadSection}>
        <div style={styles.uploadBox}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            style={styles.fileInput}
          />
          
          {!previewImage ? (
            <div style={styles.uploadContent}>
              <svg style={styles.uploadIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={styles.uploadButton}
              >
                📸 Choose Room Image
              </button>
              <p style={styles.uploadHint}>PNG, JPG up to 16MB • Works without GPU</p>
            </div>
          ) : (
            <div style={styles.previewContainer}>
              <img src={previewImage} alt="Preview" style={styles.previewImage} />
              <div style={styles.previewActions}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{...styles.button, ...styles.buttonSecondary}}
                  disabled={isDetecting}
                >
                  🔄 Change Image
                </button>
                <button
                  onClick={resetAll}
                  style={{...styles.button, ...styles.buttonDanger}}
                  disabled={isDetecting}
                >
                  🗑️ Reset All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Workflow Steps */}
      {previewImage && !isWallsDetected && (
        <div style={styles.workflowSection}>
          <h3 style={styles.sectionTitle}>🚀 Quick Start Guide</h3>
          <div style={styles.instructionBox}>
            <div style={styles.instructionStep}>
              <span style={styles.instructionNumber}>1</span>
              <div>
                <strong>Click "Detect Walls"</strong>
                <p>AI will analyze your image once (takes 5-10 minutes on CPU, 30 seconds to 2 minutes on GPU)</p>
              </div>
            </div>
            <div style={styles.instructionStep}>
              <span style={styles.instructionNumber}>2</span>
              <div>
                <strong>Change Colors Instantly</strong>
                <p>Once detected, try different colors with NO waiting!</p>
              </div>
            </div>
          </div>
          
          <div style={{textAlign: 'center', marginTop: '24px'}}>
            <button
              onClick={detectWallsOnce}
              disabled={isDetecting || apiStatus !== 'ready'}
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                fontSize: '18px',
                padding: '16px 48px'
              }}
            >
              {isDetecting ? '🔍 Detecting Walls... Please Wait' : '🔍 Detect Walls (One Time Only)'}
            </button>
            {isDetecting && (
              <p style={styles.processingHint}>
                ⏱️ This takes 5-10 minutes on CPU... Grab a coffee! ☕
              </p>
            )}
          </div>
        </div>
      )}

      {/* Detection Progress */}
      {isDetecting && (
        <div style={styles.progressSection}>
          <div style={styles.progressBar}>
            <div style={styles.progressFill}></div>
          </div>
          <p style={styles.progressText}>🧠 AI is analyzing walls without GPU...</p>
        </div>
      )}

      {/* Mask Visualization */}
      {maskVisualization && (
        <div style={styles.visualizationSection}>
          <h3 style={styles.sectionTitle}>🎭 Detected Wall Masks</h3>
          <div style={styles.visualizationBox}>
            <img src={maskVisualization} alt="Mask Visualization" style={styles.resultImage} />
            <p style={styles.visualizationHint}>
              Each color represents a different detected wall segment
            </p>
          </div>
        </div>
      )}

      {/* Instant Paint Controls */}
      {isWallsDetected && (
        <>
          <div style={styles.instantModeHeader}>
            <h2 style={styles.instantModeTitle}>
              ⚡ Instant Paint Mode - Change Colors Live!
            </h2>
            <p style={styles.instantModeSubtitle}>
              {detectionTime > 0 && `Detection took ${detectionTime.toFixed(1)}s • `}
              Paint updates in real-time {paintTime > 0 && `(~${paintTime.toFixed(2)}s)`}
            </p>
            <button
              onClick={visualizeMasks}
              disabled={isDetecting}
              style={{...styles.button, ...styles.buttonInfo}}
            >
              {isDetecting ? '⏳ Loading...' : '🎭 Show Detected Masks'}
            </button>
          </div>

          <div style={styles.controlsGrid}>
            {/* Color Picker */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🎨 Choose Your Color</h3>
              
              <div style={styles.colorPickerWrapper}>
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  style={styles.colorPicker}
                  disabled={isPainting}
                />
                <p style={styles.colorValue}>
                  {selectedColor.toUpperCase()} 
                  {isPainting && <span style={styles.paintingIndicator}> • Applying...</span>}
                </p>
              </div>

              <div style={styles.colorPalette}>
                {colorPalette.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedColor(color.hex)}
                    className="color-swatch"
                    title={color.name}
                    disabled={isPainting}
                    style={{
                      ...styles.colorSwatch,
                      backgroundColor: color.hex,
                      border: selectedColor === color.hex ? '3px solid #1f2937' : '2px solid #e5e7eb',
                      transform: selectedColor === color.hex ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: selectedColor === color.hex ? '0 4px 12px rgba(0,0,0,0.3)' : 'none'
                    }}
                  />
                ))}
              </div>
              <p style={styles.paletteHint}>Click any color for instant preview</p>
            </div>

            {/* Settings */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>⚙️ Paint Settings</h3>
              
              <div style={styles.settingGroup}>
                <label style={styles.label}>
                  Paint Opacity: {Math.round(opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  style={styles.slider}
                  disabled={isPainting}
                />
                <div style={styles.sliderLabels}>
                  <span>Subtle</span>
                  <span>Bold</span>
                </div>
              </div>

              <div style={styles.checkboxGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={mainWallsOnly}
                    onChange={(e) => setMainWallsOnly(e.target.checked)}
                    style={styles.checkbox}
                    disabled={isPainting}
                  />
                  Paint main walls only
                </label>
              </div>

              <div style={styles.infoBox}>
                <p>💡 <strong>Tip:</strong> Adjust settings and see changes instantly!</p>
              </div>
            </div>
          </div>

          {/* Wall Selection */}
          <div style={styles.wallsSection}>
            <h3 style={styles.sectionTitle}>
              🏠 Select Walls to Paint ({detectedWalls.length} detected)
            </h3>
            
            <div style={styles.wallActions}>
              <button
                onClick={() => setSelectedWalls(detectedWalls.map((_, i) => i))}
                style={{...styles.smallButton, ...styles.buttonPrimary}}
                disabled={isPainting}
              >
                ✓ Select All
              </button>
              <button
                onClick={() => setSelectedWalls([])}
                style={{...styles.smallButton, ...styles.buttonSecondary}}
                disabled={isPainting}
              >
                ✕ Deselect All
              </button>
              <div style={styles.selectionCounter}>
                {selectedWalls.length} of {detectedWalls.length} walls selected
              </div>
            </div>

            <div style={styles.wallsGrid}>
              {detectedWalls.map((wall, index) => (
                <div
                  key={index}
                  className="wall-card"
                  style={{
                    ...styles.wallCard,
                    borderColor: selectedWalls.includes(index) ? '#3b82f6' : '#e5e7eb',
                    backgroundColor: selectedWalls.includes(index) ? '#eff6ff' : '#ffffff',
                    opacity: isPainting ? 0.6 : 1
                  }}
                  onClick={() => !isPainting && toggleWallSelection(index)}
                >
                  <div style={styles.wallCardHeader}>
                    <div>
                      <h4 style={styles.wallCardTitle}>Wall {index + 1}</h4>
                      <p style={styles.wallCardType}>
                        {wall.wall_type?.replace('_', ' ') || 'Wall'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedWalls.includes(index)}
                      onChange={() => toggleWallSelection(index)}
                      style={styles.wallCheckbox}
                      disabled={isPainting}
                    />
                  </div>
                  <div style={styles.wallCardInfo}>
                    <p>📐 {wall.area?.toLocaleString()} px²</p>
                    <p>✅ {Math.round((wall.confidence || 0) * 100)}% confidence</p>
                    {wall.area_percentage && (
                      <p>📊 {wall.area_percentage.toFixed(1)}% of image</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Results Comparison */}
          {paintedImage && (
            <div style={styles.resultsSection}>
              <div style={styles.resultsHeader}>
                <h3 style={styles.sectionTitle}>✨ Before & After</h3>
                <div style={styles.resultsActions}>
                  <button
                    onClick={() => setShowComparison(!showComparison)}
                    style={{...styles.button, ...styles.buttonInfo}}
                  >
                    {showComparison ? '📱 Stack View' : '↔️ Side by Side'}
                  </button>
                  <button
                    onClick={downloadImage}
                    style={{...styles.button, ...styles.buttonSuccess}}
                  >
                    📥 Download Result
                  </button>
                </div>
              </div>
              
              <div style={showComparison ? styles.resultsGridSideBySide : styles.resultsGrid}>
                <div style={styles.resultCard}>
                  <h4 style={styles.resultTitle}>Original</h4>
                  <img src={previewImage} alt="Original" style={styles.resultImage} />
                </div>
                
                <div style={styles.resultCard}>
                  <h4 style={styles.resultTitle}>
                    Painted {isPainting && <span style={styles.paintingBadge}>⏳ Updating...</span>}
                  </h4>
                  <img src={paintedImage} alt="Painted" style={styles.resultImage} />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading Overlay */}
      {isDetecting && (
        <div style={styles.overlay}>
          <div style={styles.loadingCard}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>🔍 Detecting Walls with AI</p>
            <p style={styles.loadingHint}>This only happens once!</p>
            <p style={styles.loadingSubtext}>Processing on CPU... {detectionTime > 0 ? `${detectionTime.toFixed(0)}s` : '20-30 seconds'}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '32px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f9fafb',
    minHeight: '100vh'
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
    animation: 'fadeIn 0.6s ease-out'
  },
  title: {
    fontSize: '48px',
    fontWeight: '900',
    color: '#1f2937',
    marginBottom: '12px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-1.5px'
  },
  subtitle: {
    fontSize: '18px',
    color: '#6b7280',
    marginBottom: '24px'
  },
  statusContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '20px'
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 20px',
    borderRadius: '999px',
    fontSize: '14px',
    fontWeight: '600'
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginRight: '10px'
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    border: '2px solid #fca5a5',
    color: '#991b1b',
    padding: '16px 20px',
    borderRadius: '12px',
    marginBottom: '24px',
    fontSize: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeError: {
    background: 'none',
    border: 'none',
    color: '#991b1b',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 8px'
  },
  uploadSection: {
    marginBottom: '32px'
  },
  uploadBox: {
    border: '3px dashed #d1d5db',
    borderRadius: '16px',
    padding: '48px 32px',
    textAlign: 'center',
    backgroundColor: '#ffffff',
    transition: 'all 0.3s ease'
  },
  fileInput: {
    display: 'none'
  },
  uploadContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  uploadIcon: {
    width: '80px',
    height: '80px',
    color: '#9ca3af',
    marginBottom: '24px'
  },
  uploadButton: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    padding: '14px 40px',
    borderRadius: '12px',
    fontSize: '17px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
  },
  uploadHint: {
    color: '#9ca3af',
    fontSize: '14px',
    marginTop: '16px'
  },
  previewContainer: {
    animation: 'fadeIn 0.5s ease-out'
  },
  previewImage: {
    maxHeight: '400px',
    maxWidth: '100%',
    borderRadius: '12px',
    boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
    marginBottom: '20px'
  },
  previewActions: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  workflowSection: {
    backgroundColor: '#ffffff',
    padding: '32px',
    borderRadius: '16px',
    marginBottom: '32px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    animation: 'fadeIn 0.6s ease-out'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '20px'
  },
  instructionBox: {
    backgroundColor: '#f0f9ff',
    border: '2px solid #bae6fd',
    borderRadius: '12px',
    padding: '24px'
  },
  instructionStep: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '20px'
  },
  instructionNumber: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: '700',
    flexShrink: 0
  },
  processingHint: {
    marginTop: '16px',
    color: '#6b7280',
    fontSize: '14px',
    fontStyle: 'italic'
  },
  progressSection: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '12px',
    marginBottom: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '999px',
    overflow: 'hidden',
    marginBottom: '12px'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 2s infinite linear',
    borderRadius: '999px'
  },
  progressText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: '600'
  },
  instantModeHeader: {
    backgroundColor: '#eef2ff',
    border: '2px solid #a5b4fc',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    textAlign: 'center',
    animation: 'fadeIn 0.6s ease-out'
  },
  instantModeTitle: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#3730a3',
    marginBottom: '8px'
  },
  instantModeSubtitle: {
    fontSize: '14px',
    color: '#6366f1',
    marginBottom: '16px',
    fontWeight: '500'
  },
  button: {
    padding: '12px 28px',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
    color: '#ffffff'
  },
  buttonSecondary: {
    backgroundColor: '#6b7280',
    color: '#ffffff'
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
    color: '#ffffff'
  },
  buttonSuccess: {
    backgroundColor: '#10b981',
    color: '#ffffff'
  },
  buttonInfo: {
    backgroundColor: '#6366f1',
    color: '#ffffff'
  },
  controlsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '24px',
    marginBottom: '32px'
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '28px',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    animation: 'fadeIn 0.6s ease-out',
    border: '1px solid #e5e7eb'
  },
  cardTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '20px'
  },
  colorPickerWrapper: {
    marginBottom: '24px'
  },
  colorPicker: {
    width: '100%',
    height: '70px',
    border: '3px solid #e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  colorValue: {
    fontSize: '16px',
    color: '#374151',
    marginTop: '12px',
    textAlign: 'center',
    fontWeight: '700'
  },
  paintingIndicator: {
    color: '#f59e0b',
    fontSize: '14px',
    fontWeight: '600'
  },
  colorPalette: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '12px',
    marginBottom: '12px'
  },
  colorSwatch: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    border: '2px solid #e5e7eb'
  },
  paletteHint: {
    fontSize: '13px',
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  settingGroup: {
    marginBottom: '24px'
  },
  label: {
    display: 'block',
    fontSize: '15px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '10px'
  },
  slider: {
    width: '100%',
    height: '10px',
    borderRadius: '5px',
    outline: 'none',
    appearance: 'none',
    background: 'linear-gradient(to right, #e5e7eb 0%, #3b82f6 100%)',
    cursor: 'pointer'
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '6px',
    fontWeight: '500'
  },
  checkboxGroup: {
    marginBottom: '20px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '15px',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: '500'
  },
  checkbox: {
    marginRight: '10px',
    width: '20px',
    height: '20px',
    cursor: 'pointer'
  },
  infoBox: {
    backgroundColor: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    color: '#78350f'
  },
  wallsSection: {
    backgroundColor: '#ffffff',
    padding: '28px',
    borderRadius: '16px',
    marginBottom: '32px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    animation: 'fadeIn 0.6s ease-out',
    border: '1px solid #e5e7eb'
  },
  wallActions: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  smallButton: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  selectionCounter: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: '600',
    padding: '10px 16px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px'
  },
  wallsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px'
  },
  wallCard: {
    padding: '20px',
    border: '2px solid',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backgroundColor: '#ffffff'
  },
  wallCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  wallCardTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1f2937',
    margin: '0 0 6px 0'
  },
  wallCardType: {
    fontSize: '14px',
    color: '#6b7280',
    textTransform: 'capitalize',
    margin: 0,
    fontWeight: '500'
  },
  wallCheckbox: {
    width: '22px',
    height: '22px',
    cursor: 'pointer'
  },
  wallCardInfo: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '1.8',
    fontWeight: '500'
  },
  visualizationSection: {
    backgroundColor: '#ffffff',
    padding: '28px',
    borderRadius: '16px',
    marginBottom: '32px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb',
    animation: 'fadeIn 0.6s ease-out'
  },
  visualizationBox: {
    textAlign: 'center'
  },
  visualizationHint: {
    marginTop: '16px',
    fontSize: '14px',
    color: '#6b7280',
    fontStyle: 'italic'
  },
  resultsSection: {
    animation: 'fadeIn 0.6s ease-out',
    marginBottom: '40px'
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  resultsActions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '28px'
  },
  resultsGridSideBySide: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '28px'
  },
  resultCard: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb'
  },
  resultTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  paintingBadge: {
    fontSize: '14px',
    color: '#f59e0b',
    fontWeight: '600'
  },
  resultImage: {
    width: '100%',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(8px)'
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    padding: '48px 40px',
    borderRadius: '20px',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    animation: 'fadeIn 0.3s ease-out',
    maxWidth: '400px'
  },
  spinner: {
    width: '64px',
    height: '64px',
    border: '5px solid #e5e7eb',
    borderTop: '5px solid #3b82f6',
    borderRadius: '50%',
    margin: '0 auto 28px',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '19px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '8px'
  },
  loadingHint: {
    fontSize: '15px',
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: '4px'
  },
  loadingSubtext: {
    fontSize: '13px',
    color: '#9ca3af',
    fontStyle: 'italic'
  }
};

export default WallPaintVisualizer;