import React, { useState } from 'react';
import PptxGenJS from 'pptxgenjs';

export default function SlidePreview({ presentationData }) {
  const [isGenerating, setIsGenerating] = useState(false);

  // If there's no data, show a placeholder
  if (!presentationData || !presentationData.slides || presentationData.slides.length === 0) {
    return (
      <div style={{ flex: 1, background: '#0a1a0d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h3>No Presentation Generated Yet</h3>
        <p style={{ fontSize: 13, maxWidth: 300, textAlign: 'center' }}>
          Provide the AI with a topic and it will instantly synthesize a full presentation here.
        </p>
      </div>
    );
  }

  const handleDownload = () => {
    setIsGenerating(true);
    try {
      let pres = new PptxGenJS();
      pres.layout = "LAYOUT_16x9";
      
      const themeColor = '#fa243c';

      presentationData.slides.forEach((slideData) => {
        let slide = pres.addSlide();
        slide.background = { color: '0A1A0D' };

        // Title
        slide.addText(slideData.title, { 
          x: 0.5, y: 0.5, w: '90%', h: 1, 
          fontSize: 32, color: 'FFFFFF', bold: true, fontFace: 'Arial'
        });
        
        slide.addShape(pres.ShapeType.line, { x: 0.5, y: 1.6, w: '90%', h: 0, line: { color: 'fa243c', width: 2 } });

        // Content
        if (slideData.content && slideData.content.length > 0) {
          const formattedBullets = slideData.content.map(bullet => ({
            text: bullet, options: { bullet: true, color: 'DDDDDD', fontFace: 'Arial', fontSize: 18 }
          }));
          slide.addText(formattedBullets, { x: 0.5, y: 2.0, w: '90%', h: 3 });
        }
      });

      pres.writeFile({ fileName: `${presentationData.title || 'BotVerse_Presentation'}.pptx` })
        .then(() => setIsGenerating(false))
        .catch(() => setIsGenerating(false));
    } catch (err) {
      console.error(err);
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a1a0d' }}>
      {/* Header Bar */}
      <div style={{ padding: '10px 16px', background: '#0f2212', borderBottom: '1px solid #1a2e1d', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 15 }}>{presentationData.title || "Generated PPT"}</h3>
        <div style={{ flex: 1 }} />
        <button 
          onClick={handleDownload}
          disabled={isGenerating}
          style={{ 
            background: '#fa243c', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, 
            cursor: isGenerating ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13,
            opacity: isGenerating ? 0.7 : 1
          }}
        >
          {isGenerating ? "Exporting..." : "Download .pptx File"}
        </button>
      </div>

      {/* Visual Preview */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {presentationData.slides.map((slide, i) => (
          <div key={i} style={{ 
            background: '#050e07', borderRadius: 8, border: '1px solid #1a2e1d', aspectRatio: '16/9',
            padding: 30, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            maxWidth: 600, width: '100%', margin: '0 auto'
          }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: 24 }}>{slide.title}</h2>
            <div style={{ height: 2, background: '#fa243c', width: '100%', marginBottom: 20 }} />
            <ul style={{ margin: 0, paddingLeft: 20, color: '#ddd', fontSize: 16, lineHeight: 1.6 }}>
              {slide.content?.map((point, idx) => (
                <li key={idx} style={{ marginBottom: 10 }}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
